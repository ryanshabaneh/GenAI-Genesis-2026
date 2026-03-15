'use client'

import type { Task } from '@/types'

export default function TaskChecklist({
  tasks,
  selectedTaskIds = [],
  onTaskClick,
}: {
  tasks: Task[]
  selectedTaskIds?: string[]
  onTaskClick: (taskId: string) => void
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-fog text-xs italic">Nothing here yet — this lot is empty.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((task) => {
        const isDone = task.done
        const isSelected = !task.done && selectedTaskIds.includes(task.id)
        return (
          <li key={task.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => !task.done && onTaskClick(task.id)}
              disabled={task.done}
              aria-pressed={isSelected}
              aria-label={task.done ? `${task.label} (done)` : `${task.label} (${isSelected ? 'selected' : 'not selected'})`}
              className={`shrink-0 w-4 h-4 rounded flex items-center justify-center text-[10px] transition-colors duration-[120ms] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue focus:ring-offset-2 focus:ring-offset-surface ${
                isDone
                  ? 'bg-teal-dim border border-teal-border text-teal cursor-default'
                  : isSelected
                    ? 'bg-transparent border border-dashed border-blue text-blue'
                    : 'bg-surface3 border border-white/10 hover:border-white/20'
              }`}
            >
              {isDone && '✓'}
            </button>
            <button
              type="button"
              onClick={() => !task.done && onTaskClick(task.id)}
              disabled={task.done}
              className={`text-left text-xs font-ui leading-snug flex-1 min-w-0 ${
                isDone ? 'text-fog cursor-default' : isSelected ? 'text-fog-light' : 'text-white'
              } ${!task.done ? 'cursor-pointer hover:text-white' : ''}`}
            >
              {task.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
