import SharedProjectPlanView from '@/components/proyectos/SharedProjectPlanView'

export default function AnalistaPlanPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectPlanView params={params} portal="analista" />
}
