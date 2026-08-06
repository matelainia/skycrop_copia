import { Sparkles } from 'lucide-react';

const RECOMMENDATIONS = {
  Llenado: {
    text: 'Para cacao en etapa de Llenado prioriza potasio (KCl) para peso de semilla, mantén pH 6.0 – 6.5 y fracciona el nitrógeno en 2–3 aplicaciones.',
    badges: [
      { label: 'K alto', class: 'badge-k' },
      { label: 'N fraccionado', class: 'badge-n' },
      { label: 'Ca-Mg', class: 'badge-sec' },
    ],
  },
  Floración: {
    text: 'En etapa de Floración potencia la retención de flor con boro y zinc foliariado, además de fósforo (DAP) para desarrollo radicular.',
    badges: [
      { label: 'Boro + Zinc', class: 'badge-fol' },
      { label: 'P asimilable', class: 'badge-np' },
    ],
  },
  Mantenimiento: {
    text: 'Aplica enmienda orgánica y mantén relación N-K balanceada para asegurar sostenibilidad del suelo.',
    badges: [
      { label: 'Materia Orgánica', class: 'badge-org' },
      { label: 'pH Óptimo', class: 'badge-corr' },
    ],
  },
};

export function AgronomicRecommendation({ stage = 'Llenado' }) {
  const recommendation = RECOMMENDATIONS[stage] || RECOMMENDATIONS.Llenado;

  return (
    <div className="agronomic-recommendation-card">
      <div className="card-header">
        <Sparkles size={16} className="sparkle-icon" />
        <h4>Recomendación agronómica</h4>
      </div>
      <div className="card-body">
        <div className="leaf-badge-icon">🌿</div>
        <p className="recommendation-text">{recommendation.text}</p>
      </div>
      <div className="recommendation-badges">
        {recommendation.badges.map((b, i) => (
          <span key={i} className={`nut-badge ${b.class}`}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
