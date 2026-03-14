'use client'

// components/ui/TaskChecklist.tsx
// Pure display component — renders the list of pass/fail tasks returned by a
// building's analyzer. No logic here; all task state comes from the store via
// BuildingPanel. Completed tasks get a strikethrough so progress is glanceable.

import type { Task } from '@/types'
import clsx from 'clsx'

interface TaskChecklistProps {
  tasks: Task[]
}

export default function TaskChecklist({ tasks }: TaskChecklistProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-gray-500 italic">No tasks found for this building.</p>
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2">
          {/* Custom checkbox — green fill when done, gray border when pending */}
          <span
            className={clsx(
              'flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-xs',
              task.done
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-gray-800 border-gray-600'
            )}
          >
            {task.done && '✓'}
          </span>
          <span
            className={clsx(
              'text-sm',
              // Strikethrough + dimmed text signals "already handled" without removing the row
              task.done ? 'text-gray-300 line-through' : 'text-gray-100'
            )}
          >
            {task.label}
          </span>
        </li>
      ))}
    </ul>
  )
}
