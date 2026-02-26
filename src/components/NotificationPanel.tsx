// src/components/NotificationPanel.tsx — Bell dropdown with notification list

import { useState } from 'react'
import { useQuery as useConvexQuery, useMutation } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { NotificationType } from '~/convex/schema'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Button } from '@/ui/button'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Bell,
  ClipboardList,
  ArrowRightLeft,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  Mail,
  MailX,
  Receipt,
  FileText,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/utils/misc'

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  task_assigned: ClipboardList,
  task_handoff: ArrowRightLeft,
  task_completed: CheckCircle,
  agent_error: AlertCircle,
  lead_stage_change: TrendingUp,
  agent_message: MessageSquare,
  email_reply: Mail,
  email_bounce: MailX,
  invoice_sent: Receipt,
  invoice_paid: Receipt,
  proposal_sent: FileText,
  proposal_accepted: FileText,
  proposal_rejected: FileText,
  contract_sent: ScrollText,
  contract_signed: ScrollText,
}

const TYPE_COLORS: Record<NotificationType, string> = {
  task_assigned: 'text-blue-500',
  task_handoff: 'text-purple-500',
  task_completed: 'text-green-500',
  agent_error: 'text-red-500',
  lead_stage_change: 'text-amber-500',
  agent_message: 'text-sky-500',
  email_reply: 'text-emerald-500',
  email_bounce: 'text-orange-500',
  invoice_sent: 'text-blue-500',
  invoice_paid: 'text-green-500',
  proposal_sent: 'text-blue-500',
  proposal_accepted: 'text-green-500',
  proposal_rejected: 'text-red-500',
  contract_sent: 'text-blue-500',
  contract_signed: 'text-green-500',
}

function getNotificationRoute(n: any): { to: string; search?: Record<string, string> } {
  switch (n.resourceType) {
    case 'lead':
      return n.resourceId
        ? { to: '/dashboard/crm', search: { leadId: n.resourceId } }
        : { to: '/dashboard/crm' }
    case 'message':
      return n.agentId
        ? { to: '/dashboard/agent-chat', search: { agentId: n.agentId } }
        : { to: '/dashboard/agent-chat' }
    case 'invoice':
      return { to: '/dashboard/invoices' }
    case 'proposal':
      return { to: '/dashboard/proposals' }
    case 'contract':
      return { to: '/dashboard/contracts' }
    case 'task':
    default:
      return { to: '/dashboard' }
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export function NotificationPanel() {
  const unreadCount = useConvexQuery(api.notifications.getUnreadCount) ?? 0
  const notifications = useConvexQuery(api.notifications.getNotifications, { limit: 50 })
  const markAsRead = useMutation(api.notifications.markAsRead)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[400px]">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: any) => {
                const Icon = TYPE_ICONS[n.type as NotificationType] || Bell
                const iconColor = TYPE_COLORS[n.type as NotificationType] || 'text-muted-foreground'

                return (
                  <button
                    key={n._id}
                    onClick={() => {
                      if (!n.read) {
                        markAsRead({ notificationId: n._id as Id<'notifications'> })
                      }
                      const route = getNotificationRoute(n)
                      navigate({ to: route.to, search: route.search ?? {} })
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                      !n.read && 'bg-primary/5',
                    )}
                  >
                    <div className={cn('mt-0.5 shrink-0', iconColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm truncate', !n.read ? 'font-semibold' : 'font-medium')}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
