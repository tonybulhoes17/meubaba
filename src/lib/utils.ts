import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Merge classes Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formata data para PT-BR
export function formatDate(date: string | Date, pattern = "dd 'de' MMMM 'de' yyyy") {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: ptBR })
}

// Formata data curta
export function formatDateShort(date: string | Date) {
  return formatDate(date, 'dd/MM/yyyy')
}

// Tempo relativo (ex: "há 2 horas")
export function timeAgo(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
}

// Formata horário (ex: "19:00")
export function formatTime(time: string) {
  return time.substring(0, 5)
}

// Gera iniciais do nome
export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

// Formata nota de 0-100
export function formatRating(rating: number) {
  return rating.toFixed(0)
}

// Cor da nota (verde/amarelo/vermelho)
export function getRatingColor(rating: number): string {
  if (rating >= 70) return 'text-green-500'
  if (rating >= 40) return 'text-yellow-500'
  return 'text-red-500'
}

// Status da presença em PT-BR
export function getAttendanceLabel(status: string) {
  const labels: Record<string, string> = {
    confirmed: '✅ Vou',
    maybe: '❓ Talvez',
    declined: '❌ Não vou',
    pending: '⏳ Pendente',
  }
  return labels[status] ?? status
}

// Status da rodada em PT-BR
export function getRoundStatusLabel(status: string) {
  const labels: Record<string, string> = {
    scheduled: 'Agendada',
    ongoing: 'Em andamento',
    finished: 'Finalizada',
    cancelled: 'Cancelada',
  }
  return labels[status] ?? status
}

// Trunca texto
export function truncate(text: string, length = 50) {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

// Gera cor aleatória para time (de lista fixa)
export function getTeamColorHex(teamName: string): string {
  const colors: Record<string, string> = {
    'Time Azul': '#2563EB',
    'Time Branco': '#94A3B8',
    'Time Preto': '#334155',
    'Time Amarelo': '#EAB308',
    'Time Vermelho': '#DC2626',
    'Time Verde': '#16A34A',
  }
  return colors[teamName] ?? '#6B7280'
}

// Copia texto para clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Compartilha via Web Share API (WhatsApp, etc)
export async function shareContent(title: string, text: string, url?: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return true
    } catch {
      return false
    }
  }
  // Fallback: abre WhatsApp
  const message = encodeURIComponent(`${title}\n${text}${url ? '\n' + url : ''}`)
  window.open(`https://wa.me/?text=${message}`, '_blank')
  return true
}
