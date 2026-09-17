# D3 — Catálogo oficial propuesto (pendiente firma del negocio)

**Estado:** ✅ FIRMADO 2026-09-17. Aplicado en migración `062` + constantes UI.
Opción elegida: las 5 propuestas de artículo + General + Combustible en bodegas.

## 1. Fuentes en conflicto

| Fuente | Categorías artículo | Categorías bodega |
|---|---|---|
| DB `013` / `011` (produce datos reales) | Fungicida, Insecticida, Herbicida, Fertilizante, Semilla, Herramienta, EPP | Herramientas, Insumos Fitosanitarios, Fertilizantes, Semillas, EPP, Cosecha |
| Demo v2 | Fertilizante, Agroquímico, Semilla, Ferretería, EPP, Biológico, Embalaje, Repuesto, Combustible | General, Insumos, Agroquímicos, Semillas, Combustible |
| UI anterior (ya reemplazada) | Semillas, Fertilizantes, Herbicidas, Pesticidas, Mantenimiento, Seguridad, Herramientas | Agroquímicos, Fertilizantes, Herramientas, Otro |

## 2. Propuesta (base DB + añadidos del demo validados por uso real)

**Artículo (12):** Fungicida, Insecticida, Herbicida, Fertilizante, Semilla,
Herramienta, EPP *(los 7 actuales, sin renombrar: hay datos)* +
Biológico, Embalaje, Repuesto, Combustible *(del demo, sin equivalente actual)* +
Agroquímico *(paraguas del demo; convive con los 3 granulares)*.
Se descarta: Ferretería (cubierta por Herramienta), Pesticidas/Mantenimiento/
Seguridad (nombres UI sin respaldo en datos).

**Bodega (8):** las 6 actuales + General *(comodín del demo)* + Combustible
*(tiene artículo Combustible y tanque dedicado en el demo)*.
Se descarta renombrar Insumos Fitosanitarios→Agroquímicos (rompe datos).

## 3. Aplicación tras la firma (no ejecutar antes)

```sql
-- 062_inventario_catalogo_d3.sql (borrador, crear archivo solo con aprobación)
ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS inventario_category_check;
-- (verificar nombre real del CHECK en staging: \d public.inventario)
ALTER TABLE public.inventario ADD CONSTRAINT inventario_category_check CHECK (category IN
  ('Fungicida','Insecticida','Herbicida','Fertilizante','Semilla','Herramienta',
   'EPP','Biológico','Embalaje','Repuesto','Combustible','Agroquímico'));
ALTER TABLE public.bodegas DROP CONSTRAINT IF EXISTS bodegas_categoria_check;
ALTER TABLE public.bodegas ADD CONSTRAINT bodegas_categoria_check CHECK (categoria IN
  ('Herramientas','Insumos Fitosanitarios','Fertilizantes','Semillas','EPP',
   'Cosecha','General','Combustible'));
```

```js
// inventoryConstants.js: reemplazar CATEGORIES / WAREHOUSE_CATEGORIES por
// estas listas (único origen: este documento hasta tener endpoint/generador).
```

## 4. Preguntas para el negocio (firmar con nombre y fecha)

1. ¿Los 5 añadidos de artículo aplican o sobra alguno?
2. ¿`Agroquímico` paraguas o se migra todo a los 3 granulares?
3. ¿Bodega `General` y `Combustible` aplican?
