import SharedClientDirectoryView from '@/components/clientes/SharedClientDirectoryView'

export default function AnalistaClientesPage() {
  return (
    <SharedClientDirectoryView
      portalPrefix="analista"
      canCreate={true}
      canDelete={false}
      defaultView="table"
    />
  )
}
