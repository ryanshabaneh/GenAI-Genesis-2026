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
          <motion.div
            initial={{ scale: 0.88, y: 20, opacity: 0 }}
            animate={{ scale: 1,    y: 0,  opacity: 1 }}
            exit={{    scale: 0.93, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className={`gradient-brand rounded-[20px] p-6 w-full cursor-default relative overflow-hidden shadow-2xl ${panelClassName ?? 'max-w-md'}`}
          >
            <div className={`relative z-10 flex flex-col ${align === 'center' ? 'items-center text-center' : 'items-start text-left'}`}>
              {icon && (
                <motion.div
                  initial={{ scale: 0, rotate: '-12deg' }}
                  animate={{ scale: 1, rotate: '0deg' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.12 }}
                  className="w-14 h-14 rounded-full bg-white/10 border border-purple-border grid place-items-center text-2xl text-white mb-4 animate-bob glow-purple hover:scale-110 transition-transform duration-[150ms]"
                >
                  {icon}
                </motion.div>
              )}

              {/* Stagger children entry */}
              <motion.div
                className={`w-full flex flex-col ${align === 'center' ? 'items-center' : 'items-start'}`}
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.18 } },
                }}
              >
                {children}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
