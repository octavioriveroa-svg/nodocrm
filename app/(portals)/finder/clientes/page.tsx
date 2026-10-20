import SharedClientDirectoryView from '@/components/clientes/SharedClientDirectoryView'

export default function FinderClientesPage() {
  return (
    <SharedClientDirectoryView
      portalPrefix="finder"
      canCreate={true}
      canDelete={false}
      defaultView="grid"
    />
  )
}
