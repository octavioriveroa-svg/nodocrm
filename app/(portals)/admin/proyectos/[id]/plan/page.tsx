import SharedProjectPlanView from '@/components/proyectos/SharedProjectPlanView'

export default function AdminPlanPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectPlanView params={params} portal="admin" />
}
