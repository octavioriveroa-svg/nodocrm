import SharedProjectPlanView from '@/components/proyectos/SharedProjectPlanView'

export default function FinancieroPlanPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectPlanView params={params} portal="financiero" />
}
