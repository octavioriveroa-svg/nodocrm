import SharedProjectPlanView from '@/components/proyectos/SharedProjectPlanView'

export default function FinderPlanPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedProjectPlanView params={params} portal="finder" />
}
