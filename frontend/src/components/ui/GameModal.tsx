'use client'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface GameModalProps {
  isOpen: boolean
  onClose?: () => void     
  icon?: ReactNode         
  panelClassName?: string 
  align?: 'center' | 'start'
  children: ReactNode
}

export default function GameModal({ isOpen, onClose, icon, panelClassName, align = 'center', children }: GameModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose ?? undefined}
          className="fixed inset-0 z-50 grid place-items-center p-4 cursor-pointer"
          style={{ background: 'rgba(9,12,18,0.7)', backdropFilter: 'blur(4px)' }}
        >
          {/* Modal panel — spring scale + rotate on enter, collapses on exit */}
          <motion.div
            initial={{ scale: 0, rotate: '12.5deg' }}
            animate={{ scale: 1, rotate: '0deg' }}
            exit={{ scale: 0, rotate: '0deg' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}  // prevent backdrop click bubbling
            className={`gradient-brand rounded-[18px] p-6 w-full cursor-default relative overflow-hidden shadow-2xl ${panelClassName ?? 'max-w-md'}`}
          >
            <div className={`relative z-10 flex flex-col ${align === 'center' ? 'items-center text-center' : 'items-start text-left'}`}>
              {icon && (
                <div className="w-14 h-14 rounded-full bg-white/10 border border-purple-border grid place-items-center text-2xl text-white mb-4 animate-bob glow-purple hover:scale-110 transition-transform duration-[150ms]">
                  {icon}
                </div>
              )}

              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
