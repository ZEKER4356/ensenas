-- ==============================================================================
-- PLATAFORMA ENSEÑAS: ESQUEMA DE BASE DE DATOS POSTGRESQL (InsForge / Supabase)
-- ==============================================================================

-- Habilitar extensión para generación de identificadores únicos UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. TABLA: administradores
-- ==============================================================================
CREATE TABLE IF NOT EXISTS administradores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(50) DEFAULT 'admin',
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. TABLA: objetos (Partes y Modelos 3D Educativos para RA + LSC)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS objetos (
    id VARCHAR(64) PRIMARY KEY,                  -- Slug identificador único (ej: 'microbit', 'telescopio')
    titulo VARCHAR(150) NOT NULL,               -- Título del objeto / seña
    categoria_lsc VARCHAR(100) NOT NULL DEFAULT 'Ciencia y Tecnología', -- Categoría en LSC
    descripcion TEXT,                           -- Resumen pedagógico del objeto
    activo BOOLEAN NOT NULL DEFAULT TRUE,       -- Estado para activar o desactivar en catálogo
    
    -- Archivos 3D & Previa (Guardados en Cloud Storage)
    modelo_3d_url TEXT NOT NULL,                -- URL pública del archivo .glb / .gltf / .usdz
    icono_preview_url TEXT,                     -- URL imagen/miniatura de previa
    qr_code_url TEXT,                           -- URL o identificador del código QR de acceso directo en RA
    
    -- Explicación Accesible (Audio / Texto)
    explicacion_texto TEXT NOT NULL,            -- Texto descriptivo para síntesis de voz (Web Speech API)
    archivo_audio_url TEXT,                     -- URL opcional de audio profesional grabado en .mp3
    
    -- Traducción en Lengua de Señas Colombiana (LSC)
    video_lsc_url TEXT,                         -- URL video MP4/WebM del intérprete para overlay en RA
    video_uso_url TEXT,                         -- URL video opcional de uso pedagógico
    instrucciones_lsc JSONB DEFAULT '[]'::jsonb,-- Lista de pasos explicativos para realizar la seña
    
    -- Metadatos y Auditoría
    orden INTEGER DEFAULT 0,                    -- Posición de ordenamiento en catálogo
    creado_por UUID REFERENCES administradores(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_objetos_activo ON objetos(activo);
CREATE INDEX IF NOT EXISTS idx_objetos_categoria ON objetos(categoria_lsc);
CREATE INDEX IF NOT EXISTS idx_objetos_orden ON objetos(orden ASC);

-- ==============================================================================
-- 3. POLÍTICAS DE ACCESO Y SEGURIDAD (Row Level Security - RLS)
-- ==============================================================================
ALTER TABLE objetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública: Cualquier visitante puede ver objetos activos
DROP POLICY IF EXISTS "Lectura pública de objetos activos" ON objetos;
CREATE POLICY "Lectura pública de objetos activos" 
    ON objetos FOR SELECT 
    USING (activo = true);

-- Política para administradores autenticados o backend mediante service_role
DROP POLICY IF EXISTS "Gestión completa de objetos para administradores" ON objetos;
CREATE POLICY "Gestión completa de objetos para administradores" 
    ON objetos FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- ==============================================================================
-- 4. POBLADO INICIAL (SEED DATA) CON OBJETOS EDUCATIVOS BASE
-- ==============================================================================
INSERT INTO objetos (
    id, titulo, categoria_lsc, descripcion, activo, 
    modelo_3d_url, icono_preview_url, explicacion_texto, 
    archivo_audio_url, video_lsc_url, video_uso_url, instrucciones_lsc, orden
) VALUES 
(
    'microbit',
    'Tarjeta Programable Micro:bit',
    'Tecnología y Programación',
    'La BBC micro:bit es una pequeña tarjeta programable diseñada para facilitar el aprendizaje de la programación, electrónica y robótica educativa mediante sensores y matriz LED.',
    TRUE,
    'assets/models/microbit.glb',
    'assets/images/microbit-thumb.png',
    'Bienvenido a enseñas. Estás observando la tarjeta programable Micro:bit en Realidad Aumentada. Este dispositivo cuenta con una matriz de 25 luces LED, sensores de movimiento, brújula y botones interactivos. Es una herramienta pedagógica diseñada para aprender programación, electrónica y robótica de manera práctica e inclusiva.',
    'assets/audio/microbit-audio.wav',
    'assets/videos/microbit-lsc.mp4',
    'assets/videos/microbit-uso.mp4',
    '["1. Configuración manual: Mano dominante en letra M (o palma hacia abajo simulando la forma de una tarjeta rectangular pequeña).", "2. Movimiento: Desplazar suavemente de izquierda a derecha delineando el contorno del circuito.", "3. Orientación y gesto: Acompañar con gesto facial de precisión y señalar la matriz de luces o pines de conexión con el dedo índice."]'::jsonb,
    1
),
(
    'telescopio',
    'Telescopio Astronómico',
    'Astronomía y Ciencias',
    'Instrumento óptico que permite observar objetos lejanos, especialmente cuerpos celestes en el espacio como planetas, estrellas y nebulosas.',
    TRUE,
    'assets/models/telescopio.glb',
    'assets/images/telescopio-thumb.png',
    'Bienvenido a enseñas. Este es el telescopio astronómico en Realidad Aumentada. Es un instrumento óptico compuesto por lentes y espejos diseñado para observar cuerpos celestes lejanos como la Luna, planetas y nebulosas. Permite acercar el fascinante estudio de la astronomía al aula de clase.',
    'assets/audio/telescopio-audio.wav',
    'assets/videos/telescopio-lsc.mp4',
    'assets/videos/telescopio-uso.mp4',
    '["1. Configuración manual: Ambas manos en forma de cilindro (letra C / puño hueco) alineadas a la altura del ojo dominante.", "2. Movimiento: Extender levemente la mano delantera simulando el tubo óptico y ajustar el foco con los dedos índice y pulgar.", "3. Orientación y gesto: Inclinar la cabeza hacia arriba manteniendo la mirada en el visor con expresión de observación atenta."]'::jsonb,
    2
),
(
    'microscopio',
    'Microscopio Óptico',
    'Biología y Laboratorio',
    'Herramienta de laboratorio que amplifica imágenes de objetos diminutos que no pueden ser observados a simple vista por el ojo humano.',
    TRUE,
    'assets/models/microscopio.glb',
    'assets/images/microscopio-thumb.png',
    'Bienvenido a enseñas. Estás viendo el microscopio óptico en Realidad Aumentada. Esta herramienta de laboratorio utiliza lentes de gran aumento para observar muestras y microorganismos invisibles a simple vista, como células y bacterias, facilitando el aprendizaje en ciencias y biología.',
    'assets/audio/microscopio-audio.wav',
    'assets/videos/microscopio-lsc.mp4',
    'assets/videos/microscopio-uso.mp4',
    '["1. Configuración manual: Mano no dominante como base plana (platina). Mano dominante forma un ángulo sobre la base representando el tubo ocular.", "2. Movimiento: Con los dedos índice y pulgar de la mano derecha, realizar giros leves simulando el tornillo micrométrico de enfoque.", "3. Orientación y gesto: Acercar el rostro en ademán de mirar a través del ocular con un ojo cerrado o enfocado."]'::jsonb,
    3
)
ON CONFLICT (id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    categoria_lsc = EXCLUDED.categoria_lsc,
    descripcion = EXCLUDED.descripcion,
    modelo_3d_url = EXCLUDED.modelo_3d_url,
    explicacion_texto = EXCLUDED.explicacion_texto,
    archivo_audio_url = EXCLUDED.archivo_audio_url,
    video_lsc_url = EXCLUDED.video_lsc_url,
    instrucciones_lsc = EXCLUDED.instrucciones_lsc;
