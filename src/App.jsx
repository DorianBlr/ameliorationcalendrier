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
