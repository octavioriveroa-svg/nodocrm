import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function EpcistaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.rol === 'analista') redirect('/analista')

  return (
    <div className="flex min-h-screen">
      <Sidebar rol={profile.rol} nombre={profile.nombre} />
      <main className="flex-1 p-8" style={{ backgroundColor: '#F9F6EF' }}>
        {children}
      </main>
    </div>
  )
}
