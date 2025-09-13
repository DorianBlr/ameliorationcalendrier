import React, { useState, useEffect } from 'react'
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'

const categories = [
  { id: 'hw', name: 'Devoir', color: '#6366f1' },
  { id: 'test', name: 'Éval', color: '#fb7185' },
  { id: 'todo', name: 'À faire', color: '#f59e0b' }
]

function formatDateKey(date) {
  return date.toISOString().split('T')[0]
}

function getMonthDays(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() - start.getDay() + i)
    days.push(d)
  }
  return days
}

function getWeekDays(date) {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay() + 1)
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

function EventCard({ event }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: event.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="p-1 mb-1 rounded text-xs bg-slate-100 cursor-move">
      <span style={{ backgroundColor: categories.find(c => c.id === event.category)?.color }} className="inline-block w-2 h-2 rounded-full mr-1"></span>
      {event.title}
    </div>
  )
}

function DayCell({ date, events, onAdd, onDrop }) {
  const key = formatDateKey(date)
  const { setNodeRef } = useDroppable({ id: key })

  return (
    <div ref={setNodeRef} className="border p-2 rounded h-32 overflow-y-auto bg-white">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-semibold">{date.getDate()}</span>
        <button onClick={() => onAdd(date)} className="text-xs bg-slate-200 px-1 rounded">+</button>
      </div>
      {events[key]?.map(ev => <EventCard key={ev.id} event={ev} />)}
    </div>
  )
}

export default function App() {
  const [viewDate, setViewDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month')
  const [events, setEvents] = useState({})
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [formDate, setFormDate] = useState(null)
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState(categories[0].id)

  const days = viewMode === 'week' ? getWeekDays(viewDate) : getMonthDays(viewDate)

  function handleAdd(date) {
    setFormDate(date)
    setFormTitle('')
    setFormCategory(categories[0].id)
    setModalOpen(true)
  }

  function handleSave() {
    const key = formatDateKey(formDate)
    const newEvent = { id: Date.now().toString(), title: formTitle, category: formCategory }
    setEvents(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), newEvent]
    }))
    setModalOpen(false)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return
    const draggedId = active.id
    const targetKey = over.id

    let draggedEvent
    const updated = { ...events }

    for (const key in updated) {
      updated[key] = updated[key].filter(ev => {
        if (ev.id === draggedId) {
          draggedEvent = ev
          return false
        }
        return true
      })
    }

    if (draggedEvent) {
      updated[targetKey] = [...(updated[targetKey] || []), draggedEvent]
      setEvents(updated)
    }
  }

  const filteredEvents = Object.fromEntries(
    Object.entries(events).map(([key, list]) => [
      key,
      list.filter(ev =>
        ev.title.toLowerCase().includes(query.toLowerCase()) &&
        (selectedCategory ? ev.category === selectedCategory : true)
      )
    ])
  )

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Mon Planner</h1>
          <div className="flex gap-2">
            <button onClick={() => setViewMode('week')} className="px-2 py-1 bg-slate-200 rounded">Semaine</button>
            <button onClick={() => setViewMode('month')} className="px-2 py-1 bg-slate-200 rounded">Mois</button>
          </div>
        </header>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Rechercher..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border p-2 rounded w-full"
          />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Toutes</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          <div className={`grid ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'} gap-2`}>
            {days.map((d, i) => (
              <DayCell
                key={i}
                date={d}
                events={filteredEvents}
                onAdd={handleAdd}
              />
            ))}
          </div>
        </DndContext>

        {modalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white p-4 rounded shadow w-full max-w-sm">
              <h2 className="text-lg font-semibold mb-2">Nouvel événement</h2>
              <input
                type="text"
                placeholder="Titre"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="border p-2 rounded w-full mb-2"
              />
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
                className="border p-2 rounded w-full mb-4"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex justify-end gap-2">
                <button onClick={() => setModalOpen(false)} className="px-3 py-1 border rounded">Annuler</button>
                <button onClick={handleSave} className="px-3 py-1 bg-indigo-600 text-white rounded">Ajouter</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
