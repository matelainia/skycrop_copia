# 1. Migración del Backend Monolítico a Arquitectura Hexagonal usando Strangler Fig

* **Estado:** Aceptado
* **Fecha:** 2026-07-13
* **Autor:** Antigravity (AI Coding Assistant) & Carlos Ramírez

## Contexto y Problema

El backend de SkyCrop actualmente reside en un único archivo monolítico (`backend/api/index.js`) de más de 1800 líneas. Este archivo mezcla configuración de Express, inicializaciones de clientes de base de datos (Supabase), autenticación (Clerk), integración satelital (Google Earth Engine) y reglas de negocio del sector agrícola.

A medida que SkyCrop crece y transiciona hacia un SaaS multiempresa con requerimientos rigurosos de auditoría de certificaciones (como GlobalG.A.P. y Rainforest Alliance), este monolito presenta varios desafíos:
1. **Acoplamiento alto:** Modificaciones menores en un endpoint satelital o de clima pueden corromper de manera involuntaria flujos críticos de autenticación o inventarios.
2. **Escalabilidad y mantenibilidad complejas:** Múltiples desarrolladores trabajando sobre el mismo archivo generan constantes conflictos de código (merge conflicts).
3. **Falta de modularidad:** No existe un aislamiento claro de la lógica de negocio, haciendo muy difícil implementar pruebas unitarias o cambiar de proveedor tecnológico en el futuro (ej. migrar de Supabase a PostgreSQL directo).

## Decisiones de Diseño

Hemos decidido adoptar las siguientes estrategias de arquitectura:

1. **Arquitectura Hexagonal (Puertos y Adaptadores):**
   * El núcleo de la lógica de negocio (entidades y casos de uso) quedará encapsulado en la capa interna (Dominio y Aplicación) y será independiente de tecnologías externas.
   * Se definirán **puertos de salida** (interfaces) para acceder a bases de datos (Supabase), mensajería, o APIs externas (GEE, Clerk).
   * La infraestructura física se acoplará mediante **adaptadores de entrada** (controladores HTTP de Express) y **adaptadores de salida** (repositorios concretos de Supabase, clientes de Clerk).

2. **Organización Orientada a Dominios:**
   * El backend se dividirá en módulos bajo la carpeta `src/modules/` (ej. `company`, `lot`, `application`, `inventory`, `weather`, `satellite`). Cada módulo encapsulará sus propios enrutadores, controladores, entidades, repositorios y eventos.

3. **Patrón Strangler Fig (Higo Estrangulador) para la Migración:**
   * La refactorización se realizará de forma incremental. Se configurará una nueva aplicación de Express (`src/app.js`) que actuará como enrutador principal.
   * Aquellos endpoints que aún no se hayan migrado se delegarán de manera transparente al monolito legacy (`api/index.js`).
   * A medida que cada dominio sea migrado, se desconectará del monolito y se activará en el nuevo enrutador modular, reduciendo progresivamente el tamaño del archivo monolítico original hasta desmantelarlo por completo.

## Consecuencias

* **Positivas:**
  * **Aislamiento de la lógica de negocio:** Cambios en la infraestructura (como la base de datos o APIs de clima) se limitarán a la capa de adaptadores de infraestructura sin alterar las reglas del negocio.
  * **Cero tiempo de inactividad:** La migración progresiva garantiza que la API permanezca funcional durante todo el proceso de refactorización.
  * **Testabilidad:** Al definir puertos (interfaces) para repositorios, será sencillo mockear la base de datos y correr tests unitarios robustos con alta cobertura.
  * **Evolución limpia:** La integración de nuevos módulos agrícolas en el futuro se podrá realizar simplemente agregando una carpeta bajo `src/modules/` sin acoplamiento colateral.

* **Neutras/Negativas:**
  * **Complejidad inicial de archivos:** Pasaremos de un solo archivo a una estructura organizada con más archivos individuales por dominio (entidades, controladores, repositorios, enrutadores).
  * **Curva de aprendizaje:** El equipo de desarrollo deberá familiarizarse con la separación de responsabilidades y la inyección de dependencias en la Arquitectura Hexagonal.
