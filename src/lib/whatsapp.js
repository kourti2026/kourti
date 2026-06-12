// ─── Liens WhatsApp pré-remplis ───────────────────────────────────────
// Zéro infrastructure : on ne peut pas envoyer automatiquement (payant),
// mais chaque relance devient un seul tap avec le message déjà écrit.

// Numéro algérien → format international wa.me (0550... → 213550...)
export function waNumber(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('213')) return digits
  if (digits.startsWith('0'))   return '213' + digits.slice(1)
  return digits
}

// Lien WhatsApp : avec destinataire si phone fourni, sinon ouvre le
// sélecteur de contact (partage)
export function waLink(phone, text) {
  const base = phone ? `https://wa.me/${waNumber(phone)}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(text)}`
}

// Lien public d'une annonce
export function lienAnnonce(annonceId) {
  return `${window.location.origin}/acheteur/lot/${annonceId}`
}

// Message de partage d'une annonce (groupes WhatsApp d'acheteurs)
export function msgPartageAnnonce(annonce, lang = 'ar') {
  const lien = lienAnnonce(annonce.id)
  return lang === 'fr'
    ? `🐔 KOURTI — ${annonce.nb_sujets_restants?.toLocaleString()} sujets · ${annonce.poids_moyen} kg moy. · ${annonce.wilaya}${annonce.prix_acceptation_auto ? ` · ⚡ Acceptation immédiate à ${annonce.prix_acceptation_auto} DA/kg` : ''}\n${lien}`
    : `🐔 كورتي — ${annonce.nb_sujets_restants?.toLocaleString()} رأس · ${annonce.poids_moyen} كغ متوسط · ${annonce.wilaya}${annonce.prix_acceptation_auto ? ` · ⚡ قبول فوري بـ ${annonce.prix_acceptation_auto} دج/كغ` : ''}\n${lien}`
}

// Message récap d'une transaction (envoyé à l'autre partie, dès l'accord)
export function msgTransaction(tx, lang = 'ar') {
  const lien    = `${window.location.origin}/transaction/${tx.id}`
  const creneau = tx.date_chargement_prevue
    ? new Date(tx.date_chargement_prevue).toLocaleString(lang === 'fr' ? 'fr-DZ' : 'ar-DZ',
        { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  if (lang === 'fr') {
    const etape = {
      accord:     `✅ Accord conclu sur KOURTI : ${tx.quantite_accordee?.toLocaleString()} sujets à ${tx.prix_kg_reel} DA/kg.${creneau ? ` Chargement prévu : ${creneau}.` : ''}`,
      chargement: `🚛 Chargement en cours — transaction KOURTI.`,
      pesee:      `⚖️ Pesée faite : ${tx.poids_total_kg_pesee || '—'} kg à ${tx.prix_kg_reel} DA/kg, total ${tx.montant_total_reel ? Math.round(tx.montant_total_reel).toLocaleString() + ' DA' : '—'}.`,
      cloture:    `✅ Transaction clôturée sur KOURTI. Merci !`,
      annulee:    `🚫 Transaction annulée sur KOURTI.${tx.motif_annulation ? ` Motif : ${tx.motif_annulation}` : ''}`,
    }[tx.statut_transaction] || 'Transaction KOURTI'
    return `${etape}\nSuivi : ${lien}`
  }

  const etapeAr = {
    accord:     `✅ تم الاتفاق على كورتي: ${tx.quantite_accordee?.toLocaleString()} رأس بـ ${tx.prix_kg_reel} دج/كغ.${creneau ? ` موعد التحميل: ${creneau}.` : ''}`,
    chargement: `🚛 التحميل جارٍ — صفقة كورتي.`,
    pesee:      `⚖️ تم الوزن: ${tx.poids_total_kg_pesee || '—'} كغ بـ ${tx.prix_kg_reel} دج/كغ، المجموع ${tx.montant_total_reel ? Math.round(tx.montant_total_reel).toLocaleString() + ' دج' : '—'}.`,
    cloture:    `✅ تمت الصفقة على كورتي. شكراً!`,
    annulee:    `🚫 أُلغيت الصفقة على كورتي.${tx.motif_annulation ? ` السبب: ${tx.motif_annulation}` : ''}`,
  }[tx.statut_transaction] || 'صفقة كورتي'
  return `${etapeAr}\nالمتابعة: ${lien}`
}
