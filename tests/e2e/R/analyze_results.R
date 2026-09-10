# SKYCROP E2E — Análisis de resultados en R (spec §23)
# R NO ejecuta las pruebas; analiza test_results.json:
#   tasa de éxito, fallos por módulo, latencia, errores por endpoint,
#   distribución de severidad, regresiones, cobertura, ranking crítico.
#
# Uso:
#   Rscript tests/e2e/R/analyze_results.R tests/e2e/reports/SKYCROP_E2E_REPORT_2026-09-10.json
# Deps: jsonlite (ggplot2 opcional para gráficos)

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) stop("Uso: Rscript analyze_results.R <report.json>")
report_path <- args[1]

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Falta el paquete 'jsonlite'. Instala con: install.packages('jsonlite')")
}
library(jsonlite)

rep <- fromJSON(report_path, flatten = TRUE)
res <- as.data.frame(rep$results)

cat("== SKYCROP E2E — Análisis R ==\n")
cat("Run:", rep$run_id, "| Env:", rep$environment, "| Mode:", rep$mode, "\n\n")

# 1. Tasa de éxito global
tasa <- mean(res$status == "PASS") * 100
cat(sprintf("Tasa de éxito: %.2f%% (%d/%d)\n", tasa, sum(res$status == "PASS"), nrow(res)))

# 2. Fallos por módulo
cat("\n-- Fallos por módulo --\n")
print(table(res$module[res$status != "PASS"]))

# 3. Latencia: media/p95 por módulo
cat("\n-- Latencia media y p95 por módulo (ms) --\n")
lat <- aggregate(duration_ms ~ module, data = res,
                 FUN = function(x) c(media = mean(x), p95 = quantile(x, 0.95), n = length(x)))
print(lat)

# 4. Errores por acción/endpoint
cat("\n-- Errores por acción (top) --\n")
errs <- res[res$status != "PASS", c("test_case_id", "module", "action", "error_code", "severity")]
print(errs)

# 5. Distribución de severidad
cat("\n-- Distribución de severidad (fallos) --\n")
print(table(factor(res$severity[res$status != "PASS"], levels = c("P0", "P1", "P2", "P3", "INFO"))))

# 6. Priority Score = severity × frequency × business × security × traceability
sev_w <- c(P0 = 10, P1 = 7, P2 = 4, P3 = 1.5, INFO = 0.2)
biz_w <- c(trazabilidad = 1.5, aplicaciones = 1.3, facturacion = 1.2, ventas = 1.1, cosecha = 1.1)
fails <- res[res$status != "PASS", ]
if (nrow(fails) > 0) {
  mods <- unique(fails$module)
  scores <- sapply(mods, function(m) {
    sub <- fails[fails$module == m, ]
    freq <- nrow(sub)
    sev <- max(sev_w[sub$severity], na.rm = TRUE)
    b <- ifelse(m %in% names(biz_w), biz_w[[m]], 1.0)
    sec <- ifelse(m %in% c("seguridad", "trazabilidad"), 1.4, 1.0)
    trz <- ifelse(m == "trazabilidad", 1.5, 1.0)
    sev * max(1, log10(1 + freq) * 3) * b * sec * trz
  })
  ranking <- sort(scores, decreasing = TRUE)
  cat("\n-- Ranking de componentes críticos (Priority Score) --\n")
  print(round(ranking, 1))
} else {
  cat("\nSin fallos: no hay ranking pendiente.\n")
}

# 7. Cobertura funcional por módulo
cat("\n-- Cobertura funcional (casos por módulo) --\n")
print(table(res$module))

cat("\nListo. Usa este ranking para decidir qué optimizar primero.\n")
