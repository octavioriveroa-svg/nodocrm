import SharedClientDirectoryView from '@/components/clientes/SharedClientDirectoryView'

export default function AdminClientesPage() {
  return (
    <SharedClientDirectoryView
      portalPrefix="admin"
      canCreate={true}
      canDelete={true}
      defaultView="table"
    />
  )
}
