const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read .env.local to get Supabase URL and service role key
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')

// Clean all null bytes and normalize line endings
const cleanContent = envContent.replace(/\u0000/g, '')

const getVal = (name) => {
  const line = cleanContent.split('\n').find(l => {
    const cleanLine = l.replace(/\s/g, '')
    const cleanName = name.replace(/\s/g, '')
    return cleanLine.startsWith(cleanName)
  })
  if (!line) return ''
  const parts = line.split('=')
  if (parts.length < 2) return ''
  const val = parts.slice(1).join('=')
  return val.replace(/\s/g, '').replace(/\r/g, '')
}

const supabaseUrl = getVal('NEXT_PUBLIC_SUPABASE_URL')
const supabaseKey = getVal('SUPABASE_SERVICE_ROLE_KEY')

console.log('Parsed URL:', supabaseUrl)
console.log('Parsed Key length:', supabaseKey.length)

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: projects, error: fetchError } = await supabase
    .from('proyectos')
    .select('id, nombre_proyecto, estado')
    .eq('nombre_proyecto', 'Proyecto Test Instalaciones')

  if (fetchError) {
    console.error('Error fetching project:', fetchError)
    return
  }

  console.log(`Found ${projects.length} matching projects:`, projects)

  for (const project of projects) {
    if (project.estado !== 'en_construccion') {
      const { data, error: updateError } = await supabase
        .from('proyectos')
        .update({ estado: 'en_construccion' })
        .eq('id', project.id)
        .select()

      if (updateError) {
        console.error(`Error updating project ${project.id}:`, updateError)
      } else {
        console.log(`Successfully updated project ${project.id} to "en_construccion":`, data)
      }
    } else {
      console.log(`Project ${project.id} is already "en_construccion".`)
    }
  }
}

main().catch(console.error)
