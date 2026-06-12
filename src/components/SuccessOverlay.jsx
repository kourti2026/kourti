// Confirmation plein écran : l'utilisateur novice doit toujours savoir
// 1) que son action a marché, 2) ce qui va se passer maintenant.
export default function SuccessOverlay({ titre, sousTitre, bouton, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
      style={{ backgroundColor: '#166534' }}>
      <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center mb-6 success-pop">
        <span className="text-6xl">✅</span>
      </div>
      <p className="text-white text-2xl font-black mb-3">{titre}</p>
      {sousTitre && <p className="text-green-200 text-base mb-10">{sousTitre}</p>}
      <button
        onClick={onClose}
        className="w-full py-4 bg-white text-lg font-bold rounded-2xl active:scale-95"
        style={{ color: '#166534' }}
      >
        {bouton}
      </button>
    </div>
  )
}
