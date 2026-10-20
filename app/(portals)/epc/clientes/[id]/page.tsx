import SharedClientDetailView from '@/components/clientes/SharedClientDetailView'

export default function EpcClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedClientDetailView params={params} portalPrefix="epc" canDelete={false} />
}
