"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, Send, Menu, Copy, ThumbsUp, ThumbsDown, X, Plus, Paperclip, RotateCw, ChevronDown, ArrowUp, User, Mail, Camera, FileImage, Lightbulb, BarChart3, Code2, LogOut, Search, Gift, GraduationCap, FileText, MoreHorizontal, Check, Zap, Target, Brain, Flame, Gauge, Download, Settings, Sliders, Shield, History, Palette } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { authClient, useSession } from "@/lib/auth-client"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  imageUrl?: string
  liked?: boolean
  disliked?: boolean
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt?: number
  messagesLoaded?: boolean
}

interface AIMode {
  id: string
  name: string
  description: string
  icon: any
}

const AI_MODES: AIMode[] = [
  {
    id: "logic-breaker",
    name: "Logic Breaker",
    description: "Cuts through your arguments, finds the holes, and tells you what actually makes sense.",
    icon: Target
  },
  {
    id: "brutal-honesty",
    name: "Brutal Honesty",
    description: "Zero sugarcoating—just the truth straight up, even if it stings.",
    icon: Flame
  },
  {
    id: "deep-analyst",
    name: "Deep Analyst",
    description: "Dissects problems with cold precision and shows you the underlying structure you're missing.",
    icon: Brain
  },
  {
    id: "ego-slayer",
    name: "Ego Slayer",
    description: "Challenges your assumptions, dismantles your excuses, and forces growth.",
    icon: Zap
  },
  {
    id: "rapid-fire",
    name: "Rapid Fire",
    description: "Fast, sharp answers with no fluff—just pure signal.",
    icon: Gauge
  }
]

export default function ChatPage() {
    const router = useRouter()
    const { data: session, isPending, refetch } = useSession()
    const user = session?.user
    const [chats, setChats] = useState<Chat[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [input, setInput] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [uploadedImage, setUploadedImage] = useState<string | null>(null)
    const [showImagePreview, setShowImagePreview] = useState(false)
    const [showUploadMenu, setShowUploadMenu] = useState(false)
    const [showModeMenu, setShowModeMenu] = useState(false)
    const [selectedMode, setSelectedMode] = useState<AIMode | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [showMoreActions, setShowMoreActions] = useState(false)
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
    const [copiedCodeIndex, setCopiedCodeIndex] = useState<string | null>(null)
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [settings, setSettings] = useState({
      appearance: 'dark',
      contextLength: 'balanced',
      aiPersona: 'helpful',
      dataPrivacy: true
    })
    const uploadMenuRef = useRef<HTMLDivElement>(null)
    const modeMenuRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const moreActionsRef = useRef<HTMLDivElement>(null)
    const chatAreaRef = useRef<HTMLDivElement>(null)
    const touchStartX = useRef<number>(0)
    const touchStartY = useRef<number>(0)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const isStreamingRef = useRef<boolean>(false)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const hasMigratedRef = useRef<boolean>(false)

  // Auto-resize textarea - expands upwards
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      const newHeight = Math.min(scrollHeight, 200)
      textareaRef.current.style.height = newHeight + 'px'
    }
  }, [input])

  // Client-side image resize to reduce token usage and improve reliability
  const resizeImage = (file: File, maxDim = 1024, quality = 0.7) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
          const canvas = document.createElement("canvas")
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          const ctx = canvas.getContext("2d")
          if (!ctx) return reject(new Error("Canvas not supported"))
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL("image/jpeg", quality)
          
          const sizeInBytes = dataUrl.length
          const sizeInKB = (sizeInBytes / 1024).toFixed(2)
          console.log(`[Image Upload] Resized to ${canvas.width}x${canvas.height}, size: ${sizeInKB}KB`)
          
          resolve(dataUrl)
        }
        img.onerror = () => reject(new Error("Failed to load image for resize"))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error("Failed to read image file"))
      reader.readAsDataURL(file)
    })

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info("Web app is already installed or not supported by your browser")
      return
    }
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      toast.success("Thank you for installing PetalMind!")
    }
  }

  // Swipe gesture support for opening sidebar
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const deltaX = touchEndX - touchStartX.current
      const deltaY = Math.abs(touchEndY - touchStartY.current)

      if (deltaX > 80 && deltaY < 50 && touchStartX.current < 50 && !sidebarOpen) {
        setSidebarOpen(true)
      }
      
      if (deltaX < -80 && deltaY < 50 && sidebarOpen) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener("touchstart", handleTouchStart)
    document.addEventListener("touchend", handleTouchEnd)

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [sidebarOpen])

  // Load chats immediately when user state changes - FORCE REFETCH on mount
  useEffect(() => {
    // Force session refetch on mount to get latest auth state
    refetch()
  }, [])

  useEffect(() => {
    if (!isPending && user) {
      // User is logged in - load their chats from database immediately
      loadChatsFromDatabase()
      // Also migrate any temp chats if they exist (only once)
      if (!hasMigratedRef.current) {
        migrateTempChatsFromLocalStorage()
        hasMigratedRef.current = true
      }
    } else if (!isPending && !user) {
      // User is not logged in - load from localStorage
      const localChats = localStorage.getItem("petalmind-temp-chats")
      if (localChats) {
        try {
          const parsedChats = JSON.parse(localChats)
          setChats(parsedChats)
        } catch (error) {
          console.error("Failed to parse local chats:", error)
        }
      }
    }
  }, [user, isPending])

  // Migrate temp chats from localStorage to database when user logs in
  const migrateTempChatsFromLocalStorage = async () => {
    const localChats = localStorage.getItem("petalmind-temp-chats")
    if (!localChats) return

    try {
      const tempChats: Chat[] = JSON.parse(localChats)
      if (tempChats.length === 0) {
        localStorage.removeItem("petalmind-temp-chats")
        return
      }

      const token = localStorage.getItem("bearer_token")
      
      for (const tempChat of tempChats) {
        const chatResponse = await fetch("/api/chats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ 
            title: tempChat.title || "New Chat"
          })
        })

        if (chatResponse.ok) {
          const newDbChat = await chatResponse.json()
          const chatId = newDbChat.id.toString()

          for (const message of tempChat.messages) {
            await fetch(`/api/chats/${chatId}/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                role: message.role,
                content: message.content,
                imageUrl: message.imageUrl || null
              })
            })
          }
        }
      }

      localStorage.removeItem("petalmind-temp-chats")
      toast.success("Your previous chats have been saved to your account")
      
      // Reload chats after migration
      await loadChatsFromDatabase()
    } catch (error) {
      console.error("Failed to migrate temp chats:", error)
    }
  }

  // Save temporary chats to localStorage for non-authenticated users
  useEffect(() => {
    if (!user && chats.length > 0) {
      localStorage.setItem("petalmind-temp-chats", JSON.stringify(chats))
    }
  }, [chats, user])

  // Optimized smooth scroll
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      const behavior = isStreamingRef.current ? 'auto' : 'smooth'
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [chats, currentChatId])

  useEffect(() => {
    if (isStreamingRef.current) {
      scrollToBottom()
    }
  }, [chats])

  useEffect(() => {
    if (!isSearching && !isStreamingRef.current) {
      scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [isSearching, currentChatId])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
        setShowUploadMenu(false)
      }
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setShowMoreActions(false)
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        // Also check if we're clicking the plus button itself to avoid immediate toggle back
        const target = event.target as HTMLElement
        const isPlusButton = target.closest('button')?.title === "Select AI Mode"
        if (!isPlusButton) {
          setShowModeMenu(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadChatsFromDatabase = async () => {
    try {
      const token = localStorage.getItem("bearer_token")
      const response = await fetch("/api/chats", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      if (response.ok) {
        const dbChats = await response.json()
        
        const sortedChats = [...dbChats].sort((a, b) => {
          const dateA = new Date(b.updatedAt || b.createdAt).getTime()
          const dateB = new Date(a.updatedAt || a.createdAt).getTime()
          return dateA - dateB
        })
        
        const formattedChats = sortedChats.map((chat: any) => ({
          id: chat.id.toString(),
          title: chat.title,
          messages: [],
          createdAt: new Date(chat.createdAt).getTime(),
          updatedAt: chat.updatedAt ? new Date(chat.updatedAt).getTime() : new Date(chat.createdAt).getTime(),
          messagesLoaded: false
        }))

        setChats(formattedChats)
      }
    } catch (error) {
      console.error("Failed to load chats:", error)
    }
  }

  // Load messages for a specific chat on-demand
  const loadChatMessages = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (chat?.messagesLoaded) return

    try {
      const token = localStorage.getItem("bearer_token")
      const messagesResponse = await fetch(`/api/chats/${chatId}/messages`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      
      if (messagesResponse.ok) {
        const dbMessages = await messagesResponse.json()
        const messages: Message[] = dbMessages.map((msg: any) => ({
          id: msg.id.toString(),
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).getTime(),
          imageUrl: msg.imageUrl || undefined
        }))

        setChats(prev => prev.map(c => 
          c.id === chatId 
            ? { ...c, messages, messagesLoaded: true }
            : c
        ))
      }
    } catch (error) {
      console.error("Failed to load chat messages:", error)
    }
  }

  const createNewChat = () => {
    setCurrentChatId(null)
    setSidebarOpen(false)
  }

  const currentChat = chats.find(chat => chat.id === currentChatId)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      try {
        const imageUrl = await resizeImage(file)
        setUploadedImage(imageUrl)
        setShowImagePreview(true)
      } catch {
        const reader = new FileReader()
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string
          setUploadedImage(imageUrl)
          setShowImagePreview(true)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const removeImage = () => {
    setUploadedImage(null)
    setShowImagePreview(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSendMessage = async () => {
    if ((!input.trim() && !uploadedImage) || isSearching) return

    const messageContent = input.trim() || "Uploaded an image"
    const messageImage = uploadedImage

    setInput("")
    setUploadedImage(null)
    setShowImagePreview(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    // If no current chat is selected, create a new one
    if (!currentChatId) {
      const chatTitle = messageContent.slice(0, 50).trim()
      
      if (user) {
        try {
          const token = localStorage.getItem("bearer_token")
          const response = await fetch("/api/chats", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ title: chatTitle })
          })

          if (response.ok) {
            const newDbChat = await response.json()
            const newChatId = newDbChat.id.toString()
            
            const userMessage: Message = {
              id: Date.now().toString(),
              role: "user",
              content: messageContent,
              timestamp: Date.now(),
              imageUrl: messageImage || undefined
            }

            const newChat: Chat = {
              id: newChatId,
              title: chatTitle,
              messages: [userMessage],
              createdAt: new Date(newDbChat.createdAt).getTime(),
              updatedAt: new Date(newDbChat.updatedAt).getTime(),
              messagesLoaded: true
            }
            
            setChats(prev => [newChat, ...prev])
            setCurrentChatId(newChatId)

            await fetch(`/api/chats/${newChatId}/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                role: userMessage.role,
                content: userMessage.content,
                imageUrl: userMessage.imageUrl || null
              })
            })

            await getAIResponse(newChatId, newChat.messages)
          }
        } catch (error) {
          console.error("Failed to create chat:", error)
          toast.error("Failed to create new chat")
        }
      } else {
        const newChatId = Date.now().toString()
        const userMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content: messageContent,
          timestamp: Date.now(),
          imageUrl: messageImage || undefined
        }

        const newChat: Chat = {
          id: newChatId,
          title: chatTitle,
          messages: [userMessage],
          createdAt: Date.now(),
          messagesLoaded: true
        }
        
        setChats(prev => [newChat, ...prev])
        setCurrentChatId(newChatId)

        await getAIResponse(newChatId, newChat.messages)
      }
    } else {
      // Continue with existing chat
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageContent,
        timestamp: Date.now(),
        imageUrl: messageImage || undefined
      }

      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, userMessage]
          }
        }
        return chat
      }))

      if (user) {
        const token = localStorage.getItem("bearer_token")
        await fetch(`/api/chats/${currentChatId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            role: userMessage.role,
            content: userMessage.content,
            imageUrl: userMessage.imageUrl || null
          })
        })
      }

      const updatedMessages = [...(currentChat?.messages || []), userMessage]
      await getAIResponse(currentChatId, updatedMessages)
    }
  }

  const copyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMessageId(messageId)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedMessageId(null), 2000)
    }).catch(() => {
      const textArea = document.createElement("textarea")
      textArea.value = content
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedMessageId(messageId)
        toast.success("Copied to clipboard")
        setTimeout(() => setCopiedMessageId(null), 2000)
      } catch (err) {
        toast.error("Failed to copy")
      }
      document.body.removeChild(textArea)
    })
  }

  const copyCode = (code: string, codeKey: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCodeIndex(codeKey)
      toast.success("Code copied to clipboard")
      setTimeout(() => setCopiedCodeIndex(null), 2000)
    }).catch(() => {
      const textArea = document.createElement("textarea")
      textArea.value = code
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedCodeIndex(codeKey)
        toast.success("Code copied to clipboard")
        setTimeout(() => setCopiedCodeIndex(null), 2000)
      } catch (err) {
        toast.error("Failed to copy")
      }
      document.body.removeChild(textArea)
    })
  }

  const likeMessage = (messageId: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        return {
          ...chat,
          messages: chat.messages.map(msg => {
            if (msg.id === messageId) {
              return {
                ...msg,
                liked: !msg.liked,
                disliked: false
              }
            }
            return msg
          })
        }
      }
      return chat
    }))
    toast.success("Feedback recorded")
  }

  const dislikeMessage = (messageId: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        return {
          ...chat,
          messages: chat.messages.map(msg => {
            if (msg.id === messageId) {
              return {
                ...msg,
                disliked: !msg.disliked,
                liked: false
              }
            }
            return msg
          })
        }
      }
      return chat
    }))
    toast.success("Feedback recorded")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleQuickAction = (text: string) => {
    setInput(text)
    setShowMoreActions(false)
  }

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      localStorage.removeItem("bearer_token")
      localStorage.removeItem("petalmind-temp-chats")
      refetch()
      setChats([])
      createNewChat()
      router.push("/")
      toast.success("Signed out successfully")
    } catch (error) {
      toast.error("Failed to sign out")
    }
  }

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    if (currentChatId && user) {
      const chat = chats.find(c => c.id === currentChatId)
      if (chat && !chat.messagesLoaded) {
        loadChatMessages(currentChatId)
      }
    }
  }, [currentChatId, user])

  // Parse message content to extract code blocks
  const parseMessageContent = (content: string) => {
    const parts: Array<{ type: 'text' | 'code', content: string, language?: string }> = []
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    let lastIndex = 0
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textContent = content.slice(lastIndex, match.index).trim()
        if (textContent) {
          parts.push({ type: 'text', content: textContent })
        }
      }
      
      parts.push({
        type: 'code',
        content: match[2].trim(),
        language: match[1] || 'plaintext'
      })
      
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
      const textContent = content.slice(lastIndex).trim()
      if (textContent) {
        parts.push({ type: 'text', content: textContent })
      }
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', content: content })
    }

    return parts
  }

  const getAIResponse = async (chatId: string, messages: Message[]) => {
    const latestMessage = messages[messages.length - 1]
    
    const aiId = (Date.now() + 1).toString()
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return { 
          ...chat, 
          messages: [...chat.messages, { 
            id: aiId, 
            role: "assistant" as const, 
            content: "", 
            timestamp: Date.now() 
          }] 
        }
      }
      return chat
    }))
    
    try {
      const history = messages.slice(-12)
      
      const apiMessages = history.map((m, idx) => {
        const isLatestMessage = idx === history.length - 1
        if (m.role === "user" && m.imageUrl && isLatestMessage) {
          return { role: "user" as const, content: m.content, imageUrl: m.imageUrl }
        }
        return { role: m.role as const, content: m.content }
      })

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: apiMessages, 
          stream: true,
          mode: selectedMode?.id || null
        })
      })

      const contentType = res.headers.get("content-type") || ""

      if (res.ok && contentType.includes("text/plain")) {
        isStreamingRef.current = true

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let fullAiResponse = ""
        
        if (reader) {
          let done = false
          while (!done) {
            const { value, done: doneReading } = await reader.read()
            done = doneReading
            if (value) {
              const chunk = decoder.decode(value)
              fullAiResponse += chunk
              
              setChats(prev => prev.map(chat => {
                if (chat.id === chatId) {
                  const currentMessages = chat.messages
                  const idx = currentMessages.findIndex(m => m.id === aiId)
                  if (idx !== -1) {
                    const updatedMessages = [...currentMessages]
                    updatedMessages[idx] = { ...updatedMessages[idx], content: updatedMessages[idx].content + chunk }
                    return { ...chat, messages: updatedMessages }
                  }
                }
                return chat
              }))
            }
          }
        }

        isStreamingRef.current = false
        scrollToBottom()

        if (user && fullAiResponse) {
          const token = localStorage.getItem("bearer_token")
          await fetch(`/api/chats/${chatId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              role: "assistant",
              content: fullAiResponse
            })
          })
        }
      } else if (res.ok) {
        const data = await res.json()
        const replyText: string = data.reply || "I'm not sure how to respond to that."
        
        setChats(prev => prev.map(chat => {
          if (chat.id === chatId) {
            const currentMessages = chat.messages
            const idx = currentMessages.findIndex(m => m.id === aiId)
            if (idx !== -1) {
              const updatedMessages = [...currentMessages]
              updatedMessages[idx] = { ...updatedMessages[idx], content: replyText }
              return { ...chat, messages: updatedMessages }
            }
          }
          return chat
        }))
        
        scrollToBottom()
        
        if (user) {
          const token = localStorage.getItem("bearer_token")
          await fetch(`/api/chats/${chatId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              role: "assistant",
              content: replyText
            })
          })
        }
      } else {
        let errorMessage = "Sorry, I ran into an issue processing that. Please try again."
        try {
          const errorData = await res.json()
          if (errorData?.error) {
            errorMessage = errorData.error
            console.error("[API Error]", errorMessage)
          }
        } catch (parseErr) {
          console.error("[Error parsing API error]", parseErr)
        }
        
        toast.error(errorMessage)
        
        setChats(prev => prev.map(chat => {
          if (chat.id === chatId) {
            const currentMessages = chat.messages
            const idx = currentMessages.findIndex(m => m.id === aiId)
            if (idx !== -1) {
              const updatedMessages = [...currentMessages]
              updatedMessages[idx] = { ...updatedMessages[idx], content: errorMessage }
              return { ...chat, messages: updatedMessages }
            }
          }
          return chat
        }))
      }
    } catch (err) {
      console.error("[getAIResponse Error]", err)
      const errorMessage = err instanceof Error ? err.message : "Network error. Please check your connection and try again."
      
      toast.error(errorMessage)
      
      setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          const currentMessages = chat.messages
          const idx = currentMessages.findIndex(m => m.id === aiId)
          if (idx !== -1) {
            const updatedMessages = [...currentMessages]
            updatedMessages[idx] = { ...updatedMessages[idx], content: errorMessage }
            return { ...chat, messages: updatedMessages }
          }
        }
        return chat
      }))
    } finally {
      isStreamingRef.current = false
    }
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative inset-y-0 left-0 z-50 w-64 bg-black border-r border-white/10 transition-transform duration-300 flex flex-col`}>
        {/* Search Bar */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <Button
            onClick={createNewChat}
            className="w-full bg-white/10 hover:bg-white/20 text-white rounded-lg h-10 justify-start gap-2"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-xs text-gray-500 uppercase font-medium px-3 py-2">Recent Chats</div>
          
          {filteredChats.length === 0 ? (
            <div className="text-xs text-gray-500 px-3 py-2">
              {searchQuery ? "No chats found" : "No chats yet"}
            </div>
          ) : (
            filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => {
                  setCurrentChatId(chat.id)
                  setSidebarOpen(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                  currentChatId === chat.id
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="truncate">{chat.title}</div>
              </button>
            ))
          )}
        </div>

        {/* Account Section - Below Recent Chats */}
        <div className="border-t border-white/10 p-4">
          {user ? (
            <div className="space-y-3">
              {/* User Info Display */}
              <div className="px-3 py-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {user.name || "User"}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      {user.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sign Out Button */}
              <Button
                onClick={handleSignOut}
                className="w-full bg-white/10 hover:bg-white/20 text-white rounded-lg h-9 justify-start gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => router.push("/login")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-9"
              >
                Sign In
              </Button>
              <Button
                onClick={() => router.push("/register")}
                className="w-full bg-white/10 hover:bg-white/20 text-white rounded-lg h-9"
              >
                Create Account
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        ref={chatAreaRef}
        className="flex-1 flex flex-col w-full overflow-hidden"
        onClick={() => {
          if (sidebarOpen) {
            setSidebarOpen(false)
          }
        }}
      >
        {/* Top Bar */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 bg-black/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSidebarOpen(true)
              }}
              className="md:hidden text-gray-400 hover:text-white p-2"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Selected Mode Display (Desktop) */}
            {selectedMode && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full transition-all hover:bg-blue-600/20">
                <selectedMode.icon className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-medium text-blue-300">{selectedMode.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Install Button */}
            <Button
              onClick={handleInstallClick}
              className="hidden sm:flex bg-white/5 hover:bg-white/10 text-white rounded-lg h-9 px-4 gap-2 text-sm border border-white/10 transition-all"
            >
              <Download className="h-4 w-4" />
              Install Webapp
            </Button>

            {/* Settings Button */}
            <Button
              onClick={() => setShowSettings(true)}
              className="bg-white/5 hover:bg-white/10 text-white rounded-lg h-9 w-9 p-0 flex items-center justify-center border border-white/10 transition-all"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              onClick={createNewChat}
              className="bg-white/10 hover:bg-white/20 text-white rounded-lg h-9 px-4 gap-2 text-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 pt-6 pb-0 w-full"
        >
          {/* Show welcome interface when no messages exist */}
          {(!currentChat || currentChat.messages.length === 0) && !isSearching && (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
              <div className="text-center space-y-8 w-full">
                <h2 className="text-3xl font-semibold text-white">How can I assist you today?</h2>
                
                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
                  <button
                    onClick={() => handleQuickAction("brainstorm ideas for ")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 rounded-full transition-all"
                  >
                    <Lightbulb className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Brainstorm</span>
                  </button>

                  <button
                    onClick={() => handleQuickAction("analyze this data ")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 rounded-full transition-all"
                  >
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Analyze data</span>
                  </button>

                  <button
                    onClick={() => handleQuickAction("write code for ")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 rounded-full transition-all"
                  >
                    <Code2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Code</span>
                  </button>

                  {/* More Button */}
                  <div className="relative" ref={moreActionsRef}>
                    <button
                      onClick={() => setShowMoreActions(!showMoreActions)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 rounded-full transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">More</span>
                    </button>

                    {showMoreActions && (
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[200px] z-10">
                        <button
                          onClick={() => handleQuickAction("summarize this text ")}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/10 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-white">Summarize text</span>
                        </button>
                        <button
                          onClick={() => handleQuickAction("surprise me with ")}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/10 transition-colors"
                        >
                          <Gift className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-white">Surprise me</span>
                        </button>
                        <button
                          onClick={() => handleQuickAction("give me advice about ")}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/10 transition-colors"
                        >
                          <GraduationCap className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-white">Get advice</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto space-y-6 w-full">
            {currentChat?.messages.map((message) => (
              <div key={message.id} className="w-full">
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%]">
                      {message.imageUrl && (
                        <div className="mb-1">
                          <img 
                            src={message.imageUrl} 
                            alt="Uploaded" 
                            className="rounded-lg w-auto h-auto max-h-20 object-contain ml-auto block"
                          />
                        </div>
                      )}
                      {message.content && (
                        <div className="bg-[#2a2a2a] text-white rounded-2xl px-4 py-3 break-words overflow-hidden">
                          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere text-xs">{message.content}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    {message.content === "" && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-white/90 animate-pulse" style={{ fontFamily: 'Inter, sans-serif' }}>
                          Thinking...
                        </span>
                      </div>
                    )}
                    
                    {message.content !== "" && (
                      <div className="w-full">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({node, ...props}) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full border-collapse border border-white/20" {...props} />
                                </div>
                              ),
                              thead: ({node, ...props}) => (
                                <thead className="bg-white/5" {...props} />
                              ),
                              th: ({node, ...props}) => (
                                <th className="border border-white/20 px-3 py-2 text-left text-xs font-semibold text-gray-200" {...props} />
                              ),
                              td: ({node, ...props}) => (
                                <td className="border border-white/20 px-3 py-2 text-xs text-gray-300" {...props} />
                              ),
                              code: ({node, inline, className, children, ...props}: any) => {
                                const match = /language-(\w+)/.exec(className || '')
                                const codeString = String(children).replace(/\n$/, '')
                                
                                if (!inline && match) {
                                  const codeKey = `${message.id}-code-${match[1]}-${codeString.slice(0, 20)}`
                                  return (
                                    <div className="relative bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden w-full my-3">
                                      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                                        <span className="text-xs text-gray-400 font-mono">{match[1]}</span>
                                        <button
                                          onClick={() => copyCode(codeString, codeKey)}
                                          className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                                          title="Copy code"
                                        >
                                          {copiedCodeIndex === codeKey ? (
                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5 text-gray-400" />
                                          )}
                                        </button>
                                      </div>
                                      <div className="overflow-x-auto max-w-full">
                                        <pre className="p-4 m-0">
                                          <code className="text-xs text-gray-200 font-mono whitespace-pre">{codeString}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  )
                                }
                                
                                return (
                                  <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-gray-200" {...props}>
                                    {children}
                                  </code>
                                )
                              },
                              p: ({node, ...props}) => (
                                <p className="text-xs leading-relaxed text-gray-200 mb-2" {...props} />
                              ),
                              ul: ({node, ...props}) => (
                                <ul className="list-disc list-inside text-xs text-gray-200 space-y-1 mb-2" {...props} />
                              ),
                              ol: ({node, ...props}) => (
                                <ol className="list-decimal list-inside text-xs text-gray-200 space-y-1 mb-2" {...props} />
                              ),
                              li: ({node, ...props}) => (
                                <li className="text-xs text-gray-200" {...props} />
                              ),
                              h1: ({node, ...props}) => (
                                <h1 className="text-base font-bold text-white mt-4 mb-2" {...props} />
                              ),
                              h2: ({node, ...props}) => (
                                <h2 className="text-sm font-bold text-white mt-3 mb-2" {...props} />
                              ),
                              h3: ({node, ...props}) => (
                                <h3 className="text-xs font-bold text-white mt-2 mb-1" {...props} />
                              ),
                              a: ({node, ...props}) => (
                                <a className="text-blue-400 hover:text-blue-300 underline text-xs" target="_blank" rel="noopener noreferrer" {...props} />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => copyMessage(message.content, message.id)}
                            className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                            title="Copy"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => likeMessage(message.id)}
                            className={`p-1.5 hover:bg-white/10 rounded-md transition-colors ${
                              message.liked ? "bg-white/10" : ""
                            }`}
                            title="Like"
                          >
                            <ThumbsUp className={`h-3.5 w-3.5 ${message.liked ? "text-blue-500 fill-blue-500" : "text-gray-400"}`} />
                          </button>
                          <button
                            onClick={() => dislikeMessage(message.id)}
                            className={`p-1.5 hover:bg-white/10 rounded-md transition-colors ${
                              message.disliked ? "bg-white/10" : ""
                            }`}
                            title="Dislike"
                          >
                            <ThumbsDown className={`h-3.5 w-3.5 ${message.disliked ? "text-red-500 fill-red-500" : "text-gray-400"}`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isSearching && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 font-sans" style={{ animation: 'glow 1.5s ease-in-out infinite' }}>
                  Thinking...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

          {/* Input Area */}
          <div className="px-3 sm:px-4 pb-4 pt-0 shrink-0 w-full relative">
            <div className="max-w-4xl mx-auto w-full relative">
              <AnimatePresence>
                {showModeMenu && (
                  <motion.div 
                    ref={modeMenuRef}
                    initial={{ y: "20%", opacity: 0, scale: 0.98 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: "20%", opacity: 0, scale: 0.98 }}
                    transition={{ 
                      type: "spring", 
                      damping: 25, 
                      stiffness: 200,
                      opacity: { duration: 0.2 }
                    }}
                    className="absolute left-0 right-0 bg-[#1a1a1a] border-t border-x border-white/10 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden mb-[-1px]"
                    style={{ bottom: '100%' }}
                  >
                    <div className="py-6 overflow-y-auto max-h-[60vh] px-6">
                      <div className="flex items-center justify-between mb-6 px-2">
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-[0.1em]">AI Intelligence Modes</div>
                        <button 
                          onClick={() => setShowModeMenu(false)}
                          className="text-gray-500 hover:text-white transition-colors"
                        >
                          <ChevronDown className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {AI_MODES.map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => {
                              setSelectedMode(mode)
                              setShowModeMenu(false)
                            }}
                            className={`flex items-start gap-4 w-full px-5 py-4 hover:bg-white/10 rounded-[20px] transition-all duration-200 group ${
                              selectedMode?.id === mode.id ? 'bg-blue-600/10 border border-blue-500/30' : 'border border-transparent'
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl transition-colors ${selectedMode?.id === mode.id ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-white/10'}`}>
                              <mode.icon className="h-5 w-5" />
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{mode.name}</div>
                              <div className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{mode.description}</div>
                            </div>
                            {selectedMode?.id === mode.id && (
                              <div className="self-center">
                                <Check className="h-5 w-5 text-blue-500" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative border-t border-white/10 pt-4">
                {/* Image Preview */}
            {showImagePreview && uploadedImage && (
              <div className="mb-3">
                <div className="relative inline-block">
                  <img 
                    src={uploadedImage} 
                    alt="Upload preview" 
                    className="rounded-lg max-h-24 object-contain"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Selected Mode Badge */}
            {selectedMode && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-full">
                  <selectedMode.icon className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-blue-300">{selectedMode.name}</span>
                  <button
                    onClick={() => setSelectedMode(null)}
                    className="ml-1 hover:bg-white/10 rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-blue-300" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Input row */}
            <div className="flex items-end gap-2 sm:gap-3 w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />

              {/* Message input field with send button inside */}
              <div className="relative flex-1 min-w-0">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message PetalMind"
                  className="w-full bg-[#2a2a2a] border-0 text-white placeholder:text-gray-500 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none pl-4 sm:pl-5 pr-12 sm:pr-14 py-3.5 min-h-[52px] max-h-[200px] rounded-xl text-sm"
                  disabled={isSearching}
                  rows={1}
                  style={{ overflow: 'hidden' }}
                />
                
                <button
                  onClick={handleSendMessage}
                  disabled={(!input.trim() && !uploadedImage) || isSearching}
                  className="absolute right-2.5 bottom-2.5 p-2 bg-white text-black rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>

              {/* Plus button - Mode Selector */}
              <div className="shrink-0">
                <button
                  onClick={() => setShowModeMenu(!showModeMenu)}
                  className="flex items-center justify-center w-[52px] h-[52px] bg-[#2a2a2a] hover:bg-[#353535] rounded-xl border-0 focus:outline-none transition-colors"
                  title="Select AI Mode"
                >
                  {showModeMenu ? (
                    <X className="h-5 w-5 text-white" />
                  ) : (
                    <Plus className="h-5 w-5 text-white" />
                  )}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
    </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Settings className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Settings</h3>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* AI Configuration */}
                <section className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI Intelligence
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Context Depth</p>
                        <p className="text-xs text-gray-500">How much history the AI remembers</p>
                      </div>
                      <select 
                        value={settings.contextLength}
                        onChange={(e) => setSettings({...settings, contextLength: e.target.value})}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="compact">Compact</option>
                        <option value="balanced">Balanced</option>
                        <option value="extensive">Extensive</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Base Personality</p>
                        <p className="text-xs text-gray-500">Default AI behavior when no mode is active</p>
                      </div>
                      <select 
                        value={settings.aiPersona}
                        onChange={(e) => setSettings({...settings, aiPersona: e.target.value})}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="helpful">Helpful</option>
                        <option value="creative">Creative</option>
                        <option value="precise">Precise</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Privacy & Security */}
                <section className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Privacy & Safety
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Data Privacy Mode</p>
                      <p className="text-xs text-gray-500">Enhanced protection for sensitive queries</p>
                    </div>
                    <button
                      onClick={() => setSettings({...settings, dataPrivacy: !settings.dataPrivacy})}
                      className={`w-11 h-6 rounded-full transition-colors relative ${settings.dataPrivacy ? 'bg-blue-600' : 'bg-white/10'}`}
                    >
                      <motion.div 
                        animate={{ x: settings.dataPrivacy ? 22 : 2 }}
                        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </section>

                {/* Appearance */}
                <section className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Appearance
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {['dark', 'amoled', 'glass'].map((theme) => (
                      <button
                        key={theme}
                        onClick={() => setSettings({...settings, appearance: theme})}
                        className={`px-3 py-4 rounded-xl border text-sm font-medium capitalize transition-all ${
                          settings.appearance === theme 
                            ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3">
                <Button 
                  onClick={() => {
                    setShowSettings(false)
                    toast.success("Settings saved successfully")
                  }}
                  className="flex-1 bg-white text-black hover:bg-gray-200 rounded-xl"
                >
                  Save Changes
                </Button>
                <Button 
                  onClick={() => setShowSettings(false)}
                  variant="ghost"
                  className="flex-1 text-gray-400 hover:text-white rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}