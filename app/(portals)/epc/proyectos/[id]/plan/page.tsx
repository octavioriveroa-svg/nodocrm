import SharedProjectPlanView from '@/components/proyectos/SharedProjectPlanView'

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectPlanView params={params} portal="epc" />
}
