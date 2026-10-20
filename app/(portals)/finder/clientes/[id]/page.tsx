import SharedClientDetailView from '@/components/clientes/SharedClientDetailView'

export default function FinderClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedClientDetailView params={params} portalPrefix="finder" canDelete={false} />
}
