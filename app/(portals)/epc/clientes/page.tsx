import SharedClientDirectoryView from '@/components/clientes/SharedClientDirectoryView'

export default function EpcClientesPage() {
  return (
    <SharedClientDirectoryView
      portalPrefix="epc"
      canCreate={true}
      canDelete={false}
      defaultView="grid"
    />
  )
}
