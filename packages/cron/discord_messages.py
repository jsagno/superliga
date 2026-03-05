"""
Discord Message Templates for Daily Duel Results

All messages are in Spanish with emoji support for Discord embeds.
Messages are randomly selected when posting duel results to Discord channels.
"""

WIN_MESSAGES = [
    # Hype & Energía
    "🔥 ¡**{player}** DESTRUYÓ COMPLETAMENTE A {opponent}! {score} 💪 ¡Hora de celebrar!",
    "🎉 ¡YOOO {player} ENVIÓ A {opponent} DE VUELTA AL SPAWN! {score} ¡VAMOS!",
    "👑 ¡{player} ES UNA BESTIA ABSOLUTA! ¡{opponent} NUNCA TUVO OPORTUNIDAD! {score} 🏆",
    "⚡ ¡{player} CON EL BARRIDO LIMPIO! {score} 🌪️ ¡{opponent} SIN AIRE!",
    "🚀 ¡{player} LITERALMENTE VOLÓ POR EL ARENA Y DESTROZÓ A {opponent}! {score}",
    "💎 ¡{player} ES INVENCIBLE! ¡{opponent} ACABA DE VER LA GRANDEZA! {score} ✨",
    "😤 ¡{player} DIJO 'HOY NO' Y LE DIO UNA MASTERCLASS A {opponent}! {score}",
    "🎯 ¡EJECUCIÓN PERFECTA DE {player}! ¡{opponent} SIGUE RECUPERÁNDOSE! {score} 💥",
    "🌟 ¡TEATRO ABSOLUTO! ¡{player} HIZO VER NOVATO A {opponent}! {score} 🔥",
    "🏅 ¡RENDIMIENTO DOMINANTE DE {player}! ¡{opponent} NECESITA DESCANSAR! {score}",
    
    # Celebración de Victoria
    "🏆 ¡{player} RECLAMÓ LA CORONA! {score} ¡JUEGO TERMINADO! 👑 ¡{opponent} ESTÁ EN SHOCK!",
    "🎊 ¡QUÉ ESPECTÁCULO! ¡{player} SUBIÓ LA TEMPERATURA! {score} 🔥 ¡{opponent} NO PUEDE MANEJARLO!",
    "⚔️ ¡{player} ENTRÓ EN MODO GUERRERO! {score} ¡{opponent} NO TUVO OPORTUNIDAD! 💪",
    "🌈 ¡ASÍ SE HACE! ¡{player} LE MOSTRÓ A {opponent} QUIÉN MANDA! {score} 📈",
    "💥 ¡{player} ENTRÓ EN MODO BESTIA Y DESTROZÓ A {opponent}! {score} ¡ESTO ES LEGENDARIO!",
    "🎪 ¡LA MULTITUD ENLOQUECE! ¡{player} ACABA DE HACER UNA OBRA MAESTRA! {score} 🌟",
    "🔱 ¡NEPTUNO APRUEBA! ¡{player} DOMINÓ LOS MARES Y A {opponent}! {score} 🌊",
    "🎬 ¡VICTORIA CINEMÁTICA DE {player}! {score} ¡{opponent} ACABA DE PERDER UN ÉXITO DE TAQUILLA! 🎥",
    "🎸 ¡ESO SÍ ES UNA ACTUACIÓN! ¡{player} {score} {opponent}! 🎵 ¡VAMOSSS!",
    "🍕 ¡COMIENDO A {opponent} PARA ALMORZAR! ¡{player} SIRVIÓ UN PLATO CAMPEONATO! {score} 😋",
    
    # Estilos Alternativos
    "{player} > {opponent} ({score}) ¡SIN PREGUNTAS! 📊✨",
    "¡{player} ACABA DE ESCRIBIR HISTORIA! {score} ¡{opponent} FUE TESTIGO! 📖🔥",
    "ÚLTIMAS NOTICIAS: ¡{player} DESTRUYE A {opponent}! PUNTUACIÓN: {score} 🚨📺",
    "¡EJECUCIÓN SIN ERRORES! ¡{player} {score} {opponent}! 🎯👌",
    "¡{player} SACÓ LA BASURA ({opponent})! {score} 🗑️💯",
    "GIRO INESPERADO: ¡{player} ¡GANÓ! {score} 🌪️ ¡NADIE LO ESPERABA!",
    "¡{player} ENTRÓ EN MODO RAMPAGE! ¡{opponent} NO PUDO SEGUIR EL RITMO! {score} 🎮💥",
    "¡SÍ SÍ SÍ! ¡{player} {score} {opponent}! ¡LOS FANÁTICOS ESTÁN LOCOS! 📣🎉",
    "¡ESO ES CIENCIA! ¡{player} ACABA DE PROBAR SUPERIORIDAD! {score} {opponent} 🧪⚗️",
    "{player} > {opponent} = ¡VICTORIA! {score} ✅💪",
    
    # Adicionales (18 más para llegar a 50+)
    "⚡ ¡RAYOS Y TRUENOS! ¡{player} {{score}} {opponent} ES PURA DINAMITA! 💀",
    "🎭 ¡Y LA AUDIENCIA ENTRA EN FRENESÍ! ¡{player} ACABA DE DOMINAR! {score} 🎪",
    "👽 ¡{player}} DESCENDIÓ DEL COSMOS Y DESTRUYÓ A {opponent}! {score} 🌌",
    "🏃 ¡VELOCIDAD FLASH! ¡{player} DESAPARECIÓ DEL MAPA ANTES QUE {opponent} PARPADEARA! {score}",
    "💍 ¡{player} TIENE EL ANILLO! ¡{opponent} NO TIENE PODER PARA {score}! 👑",
    "🎓 ¡DOCTORADO EN DOMINAR! ¡{player} LE ENSEÑÓ A {opponent} QUIÉN ES EL MAESTRO! {score}",
    "🌊 ¡TSUNAMI DE SKILLS! ¡{player} ARRASÓ COMO OLA GIGANTE! {score} {{opponent} 🏄",
    "⭐ ¡{player} BRILLA COMO SUPERNOVA! ¡{opponent} NO PUEDE COMPETIR! {score} 🌠",
    "🎯 ¡BULLSEYE! ¡{player} ACERTÓ CADA GOLPE CONTRA {opponent}! {score} 🏹",
    "🔓 ¡{player} ABRIÓ LA CAJA DE LA VERDAD! ¡{opponent} VIO LA LUZ CON {score}! 💡",
    "🏋️ ¡PURA FUERZA BRUTA! ¡{player} LEVANTÓ A {opponent} COMO PLUMA! {score} 💪",
    "🎪 ¡CIRCO DE TALENTOS! ¡{player} FUE EL ACTO PRINCIPAL CON {score}! 🎭",
    "🌪️ ¡TORNADO DE FUEGO! ¡{player} ARRASÓ TODO A SU PASO! {score} 🔥",
    "🦁 ¡RUGIDO DE LEÓN! ¡{player} DEMOSTRÓ DOMINANCIA! {score} VS {opponent} 👑",
    "🎸 ¡ROCK AND ROLL! ¡{player} TOCÓ LA SINFONÍA DE LA VICTORIA! {score} 🎵",
    "🚁 ¡HELICÓPTERO DE SKILLS! ¡{player} GIRÓ ALREDEDOR DE {opponent}! {score} ✈️",
    "🌺 ¡HERMOSO Y BRUTAL! ¡{player} DESTRUYÓ CON ELEGANCIA! {score} 💎",
    "⚙️ ¡MÁQUINA DE GANAR! ¡{player} FUNCIONÓ A LA PERFECCIÓN CONTRA {opponent}! {score}",
    "🎆 ¡FUEGOS ARTIFICIALES DE VICTORIA! ¡{player} ILUMINÓ EL CIELO! {score} 🎇",
]

LOSS_MESSAGES = [
    # Empático & Alentador
    "😅 RIP {player}... {opponent} FUE MUY FUERTE. ¡LA PRÓXIMA SERÁ LA TUYA! {score}",
    "💔 ¡{player} PERDIÓ HOY PERO SEGUIMOS AMÁNDOTE! ¡MEJOR SUERTE LA PRÓXIMA! {score}",
    "🍂 ¡{player} CAYÓ ANTE {opponent}! ¡HORA DE REVISAR LAS REPETICIONES! {score} 📽️",
    "😤 ¡{opponent} TENÍA UNA MISIÓN HOY... PERO ¡{player} PELEÓ CON TODO! {score}",
    "🎭 ¡OHHH NO! ¡{player} CAMINÓ AL TERRITORIO DE {opponent}! {score} 💀",
    "🌪️ ¡{opponent} LLEGÓ COMO UN HURACÁN! ¡POBRE {player}...! {score}",
    "😭 ¡{player} LO DIO TODO PERO {opponent} TENÍA OTROS PLANES! {score}",
    "⚰️ ¡{opponent} SELLÓ EL DESTINO DE {player} HOY! ¡SIN RENCORES AUNQUE! {score}",
    "🎪 ¡QUÉ ESPECTÁCULO! ¡{opponent} ROBÓ LOS REFLECTORES DE {player}! {score} 🌟",
    "📉 ¡LAS ESTADÍSTICAS NO MIENTEN! ¡{opponent} > {player} HOY, PERO ¡ESTAMOS EN ESTE VIAJE! {score}",
    
    # Divertido & Sarcástico
    "💀 ¡{player} ACABA DE SER ENVIADO AL REINO DE LAS SOMBRAS POR {opponent}! {score} ¡F EN EL CHAT! 😭",
    "🤡 ¿{player} VS {opponent}? ¡ESA FUE UNA MALA COMBINACIÓN! {score} 😂 ¡TODOS LO VIMOS VENIR!",
    "ÚLTIMAS NOTICIAS: ¡{opponent} ACABA DE TERMINAR LA CARRERA DE {player}! ({score}) RIP 📺💔",
    "¡{opponent} DIJO 'AGARRA ESTOS PUÑOS' Y ¡{player} NO PUDO! {score} 👊😤",
    "😵 ¡{player} SE VOLVIÓ LOCO! ¡{opponent} FUE DEMASIADO! {score} ¡SIÉNTETE MEJOR! 💕",
    "¡AUCH! ¡{opponent} ACABA DE SER MUY RUDO CON {player} CON {score}! 😬 ¡BRUTAL!",
    "¡{player} SIGUE VIENDO ESTRELLAS! ¡{opponent} {score} QUÉ GOLPE! ⭐💫",
    "NO ES UNA SORPRESA: ¡{opponent} DERROTÓ A {player} {score}! ¡PREDECIBLE! 📺😴",
    "🎢 ¡{player} MONTÓ EL PÉRDIDA TODO EL CAMINO HACIA ABAJO! ¡{opponent} {score}! 📉",
    "¡{player} TUVO UN GRAN JUEGO... PARA PRACTICAR! ¡{opponent} LE MOSTRÓ CÓMO SE HACE DE VERDAD! {score}",
    
    # Apoyo Emocional
    "¡{player}, {opponent} TE GANÓ ESTA VEZ PERO ¡TU HISTORIA DE REGRESO COMIENZA AQUÍ! {score} 📖💪",
    "¡NOOOO {player}!!! ¡{opponent} TE DERROTÓ {score} PERO ¡CREEMOS EN TI! 💙💙",
    "¡{player} PERDIÓ PERO LAS LEYENDAS SE CONSTRUYEN CON PÉRDIDAS! {score} 🏋️‍♂️",
    "¡{opponent} GANÓ {score} PERO {player}, ¡SIGUES SIENDO UN CAMPEÓN PARA NOSOTROS! 🏆💕",
    "¡NO HOY, {player}! ¡PERO MAÑANA? ¡MAÑANA ES TUYO! {score} 🌅",
    "¡{opponent} {score} {player} PERO ¡SABEMOS DE QUÉ ES CAPAZ {player}! ✨",
    "¡COMIENZO DIFÍCIL PARA {player}! ¡{opponent} ACABA DE {score}! ¡TÚ PUEDES! 💪🔥",
    "¡CAÍDO PERO NO DERROTADO! ¡{player} PERDIÓ ANTE {opponent} {score} PERO ¡VOLVEREMOS! 🔄",
    "¡POLVO DE TI {player}! ¡{opponent} {score} PERO ESTA PÉRDIDA ALIMENTA LA PRÓXIMA VICTORIA! 🚀",
    "¡REVÉS TEMPORAL! ¡{player} PERDIÓ ANTE {opponent} {score} PERO ¡ESTO NO ES EL FIN! 📈",
    
    # Desviación Humorística
    "🌮 ¡{opponent} SIRVIÓ A {player} UN PLATO DE PÉRDIDA! {score} ¡ESTILO BUFET! 😂",
    "¡{player}, ¡TE ENGAÑARON! ¡{opponent} {score} - ¡ESA ES UNA ESTAFA CLÁSICA! 😅",
    "🎰 ¡{opponent} GANÓ EL JACKPOT CONTRA {player}! {score} ¡A VECES GANAS, A VECES PIERDES! 💸",
    "¡{player} APRENDIÓ UNA LECCIÓN VALIOSA HOY: ¡NO PELEES CONTRA {opponent}! {score} 📚",
    "¡BIENVENIDO AL CLUB {player}! ¡{opponent} ¡DERROTA A TODOS! {score} 🎖️",
    "{opponent} > {player} HOY ({score}) ¡¡SORPRENDIENDO A NADIE!! 📊😂",
    "¡{player} REALMENTE LO INTENTÓ PERO {opponent} TENÍA OTROS PLANES! {score} 🤷",
    "¡BUENO, ¡ESO PASÓ! ¡{opponent} {score} {player}! ¿INESPERADO? ¡NO! 🌪️",
    "POV: ERES {player} Y ACABA DE RECIBIR {score} DE {opponent}! 😵‍💫",
    "¡{opponent} ESCRIBIÓ EL GUIÓN, CORTE DE DIRECTOR! ¡{player} ERA SOLO UNA EXTRA! {score} 🎬",
    
    # Dramático (10 más)
    "¡¡¡TRAGEDIA!!! ¡{opponent} DERROTA A {player} {score}! ¡LA MOLESTIA! 🎭💔",
    "¡Y CON ESO, {opponent} ENVÍA A {player} AL BRACKET DE PERDEDORES! {score} 📺",
    "¡RUPTURA EN {score}! ¡{player} LO DIO TODO PERO {opponent} TENÍA MÁS! 💔",
    "¡¡EL REINADO TERMINA!! ¡{opponent} DESTRONA A {player} {score}! 👑➡️👑",
    "¡¡EL SUEÑO DE {player}... NEGADO!! ¡{opponent} {score}! ¡QUÉ MOMENTO! 🌟",
    "¡SIN MILAGRO PARA {player} HOY! ¡{opponent} COMPLETÓ LA MISIÓN! {score} ✅",
    "¡¡LOS DIOSES HAN HABLADO!! ¡{opponent} {score} {player}! ¡DESTINO CUMPLIDO! ⚡",
    "¡{player} LA QUERÍA MÁS PERO {opponent} LA QUERÍA MÁÁS! {score} 🏃",
    "¡¡LAS LEYENDAS SE FORJAN EN LA DERROTA!! ¡{player} ACABA DE DAR SU PRIMER PASO! {score} 🔨",
    "¡¡{opponent} GRABÓ SU NOMBRE EN LA HISTORIA!! ¡{player} {score} - ¡PRESENCIALO! 📖",
]


def get_random_win_message():
    """Returns a random win message."""
    import random
    return random.choice(WIN_MESSAGES)


def get_random_loss_message():
    """Returns a random loss message."""
    import random
    return random.choice(LOSS_MESSAGES)


def format_message(template, player, opponent, score):
    """
    Format a message template with player data.
    
    Args:
        template: Message template with {player}, {opponent}, {score} placeholders
        player: Winner's nick (for WIN) or Loser's nick (for LOSS)
        opponent: Loser's nick (for WIN) or Winner's nick (for LOSS)
        score: Final score (e.g., "2-0" or "2-1")
        
    Returns:
        Formatted message with all placeholders replaced
    """
    return template.format(
        player=player,
        opponent=opponent,
        score=score
    )
