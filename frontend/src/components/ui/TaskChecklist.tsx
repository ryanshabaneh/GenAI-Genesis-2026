'use client'

import type { Task } from '@/types'

export default function TaskChecklist({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-fog text-xs italic">Nothing here yet — this lot is empty.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2">
          <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors duration-[120ms] ${
            task.done
              ? 'bg-teal-dim border-teal-border text-teal'
              : 'bg-surface3 border-white/10'
          }`}>
            {task.done && '✓'}
          </span>
          <span className={`text-xs font-ui leading-snug ${task.done ? 'text-fog' : 'text-white'}`}>
            {task.label}
          </span>
        </li>
      ))}
    </ul>
  )
}
