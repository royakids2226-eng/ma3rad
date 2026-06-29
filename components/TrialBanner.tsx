'use client'
import { useState, useEffect } from 'react'

export default function TrialBanner() {
  const [daysLeft, setDaysLeft] = useState(0)

  useEffect(() => {
    const startDate = new Date('2026-06-29')
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 15)
    
    const now = new Date()
    const diff = endDate.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    setDaysLeft(Math.max(0, Math.min(15, days)))
  }, [])

  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-xl shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">✨ نسخة تجريبية</div>
          <div className="text-xs opacity-90">بدأت: 29 يونيو 2026</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-black">{daysLeft}</div>
          <div className="text-xs">يوم متبقي</div>
        </div>
      </div>
      <div className="mt-2 bg-white/20 rounded-full h-2">
        <div 
          className="bg-white h-full rounded-full transition-all"
          style={{ width: `${(daysLeft / 15) * 100}%` }}
        />
      </div>
    </div>
  )
}
