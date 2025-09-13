import React, { useState, useEffect, useRef } from 'react'

const DEFAULT_CATEGORIES = [
  { id: 'hw', name: 'Devoir', color: '#6366f1' },
  { id: 'test', name: 'Éval', color: '#fb7185' },
  { id: 'todo', name: 'À faire', color: '#f59e0b' },
  { id: 'other', name: 'Autre', color: '#38bdf8' }
]

const DEFAULT_SUBJECTS = [
  { id: 'math', name: 'Maths', color: '#ef4444' },
  { id: 'fr', name: 'Français', color: '#60a5fa' },
  { id: 'en', name: 'Anglais', color: '#34d399' }
]

function formatDayKey(date) {
  return date.toISOString().split('T')[0]
}

function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function daysInMonthGrid(viewDate) {
  const start = startOfMonth(viewDate)
  const startWeekday = start.getDay()
  const mondayShift = (startWeekday + 6) % 7
  const firstShown = new Date(start)
  firstShown.setDate(start.getDate() - mondayShift)
  const arr = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstShown)
    d.setDate(firstShown.getDate() + i)
    arr.push(d)
  }
  return arr
}

function computeReminderTimestamp(eventDateKey, option, customDays, timeStr) {
  const [y, m, d] = eventDateKey.split('-').map(Number)
  const eventDate = new Date(y, m - 1, d)
  let remindDate = new Date(eventDate)
  if (option === 'daysBefore') remindDate.setDate(eventDate.getDate() - Number(customDays || 0))
  else if (option === 'mondayBefore') remindDate.setDate(eventDate.getDate() - ((eventDate.getDay() + 6) % 7))
  else if (option === 'fridayBefore') remindDate.setDate(eventDate.getDate() - ((eventDate.getDay() + 2) % 7))
  if (timeStr && /^[0-9]{2}:[0-9]{2}$/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(Number)
    remindDate.setHours(hh, mm, 0, 0)
  } else remindDate.setHours(9, 0, 0, 0)
  return remindDate.getTime()
}
export default function App() {
  const today = new Date()
  const [viewDate, setViewDate] = useState(startOfMonth(today))
  const [events, setEvents] = useState(() => {
    try {
      const raw = localStorage.getItem('planner-events-v1')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const [categories, setCategories] = useState(() => {
    try {
      const raw = localStorage.getItem('planner-categories-v1')
      return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES
    } catch {
      return DEFAULT_CATEGORIES
    }
  })

  const [subjects, setSubjects] = useState(() => {
    try {
      const raw = localStorage.getItem('planner-subjects-v1')
      return raw ? JSON.parse(raw) : DEFAULT_SUBJECTS
    } catch {
      return DEFAULT_SUBJECTS
    }
  })

  const [selectedDate, setSelectedDate] = useState(null)
  const [form, setForm] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingOriginalKey, setEditingOriginalKey] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('planner-notifs-enabled-v1')) ?? true
    } catch {
      return true
    }
  })
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('planner-dark-mode')) ?? false
    } catch {
      return false
    }
  })
  const [filterStatus, setFilterStatus] = useState('all')
  const checkIntervalRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('planner-events-v1', JSON.stringify(events))
  }, [events])

  useEffect(() => {
    localStorage.setItem('planner-categories-v1', JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    localStorage.setItem('planner-subjects-v1', JSON.stringify(subjects))
  }, [subjects])

  useEffect(() => {
    localStorage.setItem('planner-notifs-enabled-v1', JSON.stringify(notifEnabled))
  }, [notifEnabled])

  useEffect(() => {
    localStorage.setItem('planner-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (!notifEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    function checkReminders() {
      const now = Date.now()
      let changed = false
      const updated = Object.fromEntries(
        Object.entries(events).map(([key, list]) => [
          key,
          list.map(ev => {
            if (
              ev.reminder?.enabled &&
              !ev.reminder.notified &&
              typeof ev.reminder.remindAt === 'number' &&
              ev.reminder.remindAt <= now
            ) {
              try {
                new Notification(ev.title || 'Rappel', {
                  body: `${ev.title} — ${key}`
                })
              } catch {}
              changed = true
              return {
                ...ev,
                reminder: { ...ev.reminder, notified: true }
              }
            }
            return ev
          ])
        ])
      )
      if (changed) setEvents(updated)
    }

    checkReminders()
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    checkIntervalRef.current = setInterval(checkReminders, 30000)
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    }
  }, [notifEnabled, events])
  const calendarDays = daysInMonthGrid(viewDate)

  const upcomingReminders = Object.entries(events)
    .flatMap(([key, list]) =>
      list
        .filter(ev => ev.reminder?.enabled && !ev.reminder?.notified && typeof ev.reminder?.remindAt === 'number')
        .map(ev => ({ ...ev, dayKey: key }))
    )
    .sort((a, b) => a.reminder.remindAt - b.reminder.remindAt)

  function openAddModal(date) {
    setSelectedDate(date)
    setForm({
      title: '',
      category: categories[0]?.id || 'other',
      subjectId: subjects[0]?.id || '',
      notes: '',
      done: false,
      reminderEnabled: false,
      option: 'daysBefore',
      daysBefore: 1,
      time: '09:00'
    })
    setEditingId(null)
    setEditingOriginalKey(null)
    setModalOpen(true)
  }

  function openEditModal(dayKey, ev) {
    const d = parseDayKey(dayKey)
    setSelectedDate(d)
    setForm({
      title: ev.title || '',
      category: ev.category || categories[0]?.id || 'other',
      subjectId: ev.subjectId || '',
      notes: ev.notes || '',
      done: !!ev.done,
      reminderEnabled: !!ev.reminder?.enabled,
      option: ev.reminder?.option || 'daysBefore',
      daysBefore: ev.reminder?.daysBefore ?? 1,
      time: ev.reminder?.time ?? '09:00'
    })
    setEditingId(ev.id)
    setEditingOriginalKey(dayKey)
    setModalOpen(true)
  }

  function saveEvent(e) {
    e?.preventDefault()
    if (!selectedDate || !form) return
    const key = formatDayKey(selectedDate)
    const id = editingId || Date.now().toString()
    const remindAt = form.reminderEnabled
      ? computeReminderTimestamp(key, form.option, form.daysBefore, form.time)
      : null
    const reminder = form.reminderEnabled
      ? {
          enabled: true,
          option: form.option,
          daysBefore: Number(form.daysBefore),
          time: form.time,
          remindAt,
          notified: false
        }
      : { enabled: false }

    const eventObj = {
      id,
      title: form.title.trim() || 'Sans titre',
      category: form.category,
      subjectId: form.subjectId,
      notes: form.notes,
      done: !!form.done,
      reminder
    }

    setEvents(prev => {
      const copy = { ...prev }
      if (editingId && editingOriginalKey && editingOriginalKey !== key) {
        copy[editingOriginalKey] = (copy[editingOriginalKey] || []).filter(x => x.id !== editingId)
        if ((copy[editingOriginalKey] || []).length === 0) delete copy[editingOriginalKey]
      }
      if (copy[key]) {
        if (editingId) copy[key] = copy[key].map(x => (x.id === editingId ? eventObj : x))
        else copy[key] = [...copy[key], eventObj]
      } else copy[key] = [eventObj]
      return copy
    })

    setModalOpen(false)
    setEditingId(null)
    setEditingOriginalKey(null)
    setForm(null)
  }

  function deleteEvent(dayKey, id) {
    setEvents(prev => {
      const copy = { ...prev }
      if (!copy[dayKey]) return copy
      copy[dayKey] = copy[dayKey].filter(x => x.id !== id)
      if (copy[dayKey].length === 0) delete copy[dayKey]
      return copy
    })
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-6 font-sans">
        <div className="max-w-6xl mx-auto">
          <header className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Mon planner lycée</h1>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-1 text-sm">
                Notifications
                <input
                  type="checkbox"
                  checked={notifEnabled}
                  onChange={e => {
                    setNotifEnabled(e.target.checked)
                    if (
                      e.target.checked &&
                      typeof Notification !== 'undefined' &&
                      Notification.permission !== 'granted'
                    )
                      Notification.requestPermission().then(p => setNotifPermission(p))
                  }}
                />
              </label>
              <button
                onClick={() => setDarkMode(d => !d)}
                className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-sm"
              >
                {darkMode ? '☀️ Clair' : '🌙 Sombre'}
              </button>
            </div>
          </header>

          {          <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Calendrier */}
            <section className="lg:col-span-3 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="px-3 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">◀</button>
                  <div className="text-lg font-medium">{viewDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="px-3 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">▶</button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-sm">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                  <div key={d} className="text-center font-semibold pb-2">{d}</div>
                ))}
                {calendarDays.map((d, idx) => {
                  const key = formatDayKey(d)
                  const isCurrentMonth = d.getMonth() === viewDate.getMonth()
                  const dayEvents = events[key] || []
                  const isToday = formatDayKey(d) === formatDayKey(today)
                  return (
                    <div key={idx} className={`p-2 rounded-lg h-32 border overflow-y-auto ${isCurrentMonth ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700 text-slate-400'} ${isToday ? 'ring-2 ring-indigo-300' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{d.getDate()}</div>
                        <button onClick={() => openAddModal(d)} className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-600">+Ajouter</button>
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayEvents
                          .filter(ev => filterStatus === 'all' || (filterStatus === 'done' ? ev.done : !ev.done))
                          .map(ev => (
                            <div key={ev.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1">
                                <input type="checkbox" checked={ev.done} onChange={() => {
                                  setEvents(prev => {
                                    const copy = { ...prev }
                                    copy[key] = copy[key].map(x => x.id === ev.id ? { ...x, done: !x.done } : x)
                                    return copy
                                  })
                                }} />
                                <span className={`truncate max-w-[100px] ${ev.done ? 'line-through' : ''}`}>{ev.title}</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => openEditModal(key, ev)} title="Modifier">✎</button>
                                <button onClick={() => deleteEvent(key, ev.id)} title="Supprimer">✖</button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Sidebar */}
            <aside className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm">
              <h3 className="font-semibold mb-2">Filtrer par statut</h3>
              <div className="flex gap-2 mb-4">
                {['all', 'done', 'todo'].map(f => (
                  <button key={f} onClick={() => setFilterStatus(f)} className={`px-2 py-1 rounded text-sm ${filterStatus === f ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>
                    {f === 'all' ? 'Tous' : f === 'done' ? 'Fait' : 'À faire'}
                  </button>
                ))}
              </div>

              <h3 className="font-semibold mb-2">Catégories</h3>
              <div className="space-y-2 mb-4">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <input type="color" value={c.color} onChange={e => setCategories(prev => prev.map(x => x.id === c.id ? { ...x, color: e.target.value } : x))} />
                    <input className="border rounded px-2 py-1 text-sm" value={c.name} onChange={e => setCategories(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} />
                    <button onClick={() => setCategories(prev => prev.filter(x => x.id !== c.id))} className="text-xs text-rose-600">Suppr.</button>
                  </div>
                ))}
                <button onClick={() => setCategories(prev => [...prev, { id: 'cat_' + Date.now(), name: 'Nouvelle', color: '#a3a3a3' }])} className="mt-2 px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-sm">+ Ajouter</button>
              </div>

              <h3 className="font-semibold mb-2">Matières</h3>
              <div className="space-y-2 mb-4">
                {subjects.map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input type="color" value={s.color} onChange={e => setSubjects(prev => prev.map(x => x.id === s.id ? { ...x, color: e.target.value } : x))} />
                    <input className="border rounded px-2 py-1 text-sm" value={s.name} onChange={e => setSubjects(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} />
                    <button onClick={() => setSubjects(prev => prev.filter(x => x.id !== s.id))} className="text-xs text-rose-600">Suppr.</button>
                  </div>
                ))}
                <button onClick={() => setSubjects(prev => [...prev, { id: 'sub_' + Date.now(), name: 'Nouvelle matière', color: '#9ca3af' }])} className="mt-2 px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-sm">+ Ajouter</button>
              </div>

              <h3 className="font-semibold mb-2">Rappels à venir</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {upcomingReminders.slice(0, 10).map(ev => (
                  <div key={ev.id} className="p-2 rounded border dark:border-slate-600">
                    <div className="text-sm font-semibold">{ev.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Rappel le {new Date(ev.reminder.remindAt).toLocaleString('fr-FR')}</div>
                    <button onClick={() => { setViewDate(startOfMonth(parseDayKey(ev.dayKey))); openEditModal(ev.dayKey, ev) }} className="mt-1 text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">Voir</button>
                  </div>
                ))}
              </div>
            </aside>
          </main>

          {/* Modale */}
          {modalOpen && form && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
              <form onSubmit={saveEvent} className="bg-white dark:bg-slate-800 p-4 rounded-xl w-full max-w-md shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Ajouter / modifier</h3>
                <div className="mb-2 text-sm">Date: {selectedDate ? formatDayKey(selectedDate) : '-'}</div>
                <label className="block text-xs">Titre</label>
                <input className="w-full border p-2 rounded mb-2" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target}
          {/* Je peux te livrer cette partie dans le prochain bloc si tu veux continuer */}
        </div>
      </div>
    </div>
  )
}
