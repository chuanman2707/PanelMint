'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from './icons'

interface ModalProps {
    open: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
    return (
        <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <AnimatePresence>
                {open && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            />
                        </Dialog.Overlay>
                        <Dialog.Content asChild>
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                className={`fixed left-[50%] top-[50%] z-50 w-full translate-x-[-50%] translate-y-[-50%] p-4 ${maxWidth}`}
                            >
                                <div className="overflow-hidden rounded-[var(--neo-radius-lg)] border-2 border-black bg-white shadow-[var(--neo-shadow-card)]">
                                    {title && (
                                        <div className="flex items-center justify-between border-b-2 border-black bg-[var(--neo-bg-canvas)] px-6 py-4">
                                            <Dialog.Title className="text-xl font-bold uppercase tracking-wide text-black">
                                                {title}
                                            </Dialog.Title>
                                            <button
                                                onClick={onClose}
                                                className="rounded-full p-2 hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-black"
                                            >
                                                <Icon name="close" size={20} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="p-6">
                                        {children}
                                    </div>
                                </div>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    )
}
