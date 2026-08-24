import type { NextConfig } from "next";
import path from "path";

// Raíz del monorepo (donde node_modules contiene 'next').
// Se fija de forma absoluta porque Turbopack infiere mal la raíz cuando
// existen lockfiles sueltos en directorios superiores (p.ej. C:\Users\ASUS).
// Si mueves este repositorio, actualiza esta constante.
const workspaceRoot = path.resolve(process.cwd(), "..", "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
