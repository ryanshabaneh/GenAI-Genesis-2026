'use client'

// typewriter — types/deletes strings from the text array
// pure react + setTimeout, no gsap needed
// loop: cycles through all strings in text array
// cursor: blinks via css animation, hideable while typing

import { useState, useEffect, useMemo, ElementType, createElement } from 'react'

interface TextTypeProps {
  text: string | string[]
  as?: ElementType
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  initialDelay?: number
  loop?: boolean
  showCursor?: boolean
  hideCursorWhileTyping?: boolean
  cursorChar?: string
  className?: string
  cursorClassName?: string
  textColor?: string
}

export default function TextType({
  text,
  as: Tag = 'span',
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseDuration = 2000,
  initialDelay = 0,
  loop = true,
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorChar = '|',
  className = '',
  cursorClassName = '',
  textColor = 'inherit',
}: TextTypeProps) {
  const strings = useMemo(() => (Array.isArray(text) ? text : [text]), [text])

  const [displayed,   setDisplayed]   = useState('')
  const [charIdx,     setCharIdx]      = useState(0)
  const [strIdx,      setStrIdx]       = useState(0)
  const [isDeleting,  setIsDeleting]   = useState(false)

  useEffect(() => {
    const current = strings[strIdx]
    let timeout: ReturnType<typeof setTimeout>

    if (!isDeleting) {
      if (charIdx < current.length) {
        // still typing
        const delay = charIdx === 0 && strIdx === 0 ? initialDelay : typingSpeed
        timeout = setTimeout(() => {
          setDisplayed(current.slice(0, charIdx + 1))
          setCharIdx(c => c + 1)
        }, delay)
      } else {
        // finished typing — pause then delete
        if (!loop && strIdx === strings.length - 1) return
        timeout = setTimeout(() => setIsDeleting(true), pauseDuration)
      }
    } else {
      if (displayed.length > 0) {
        // still deleting
        timeout = setTimeout(() => {
          setDisplayed(d => d.slice(0, -1))
        }, deletingSpeed)
      } else {
        // finished deleting — move to next string
        setIsDeleting(false)
        setCharIdx(0)
        setStrIdx(i => (i + 1) % strings.length)
      }
    }

    return () => clearTimeout(timeout)
  }, [charIdx, displayed, isDeleting, strIdx, strings, typingSpeed, deletingSpeed, pauseDuration, initialDelay, loop])

  const typing = charIdx < strings[strIdx].length || isDeleting
  const hideCursor = hideCursorWhileTyping && typing

  return createElement(
    Tag,
    { className: `text-type ${className}` },
    <span style={{ color: textColor }}>{displayed}</span>,
    showCursor && (
      <span
        className={`inline-block animate-scan-pulse ${hideCursor ? 'opacity-0' : ''} ${cursorClassName}`}
        aria-hidden="true"
      >
        {cursorChar}
      </span>
    )
  )
}
