import SharedProjectDirectoryView from '@/components/proyectos/SharedProjectDirectoryView'

export default function AdminProyectosPage() {
  return <SharedProjectDirectoryView portalPrefix="admin" canDelete={true} />
}
