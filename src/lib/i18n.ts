import { createContext, useContext } from "react";
import type { AppLanguage } from "./types";

interface I18nValue {
  language: AppLanguage;
}

export const normalizeLanguage = (value?: string): AppLanguage =>
  value === "en" || value === "gl" ? value : "es";

const GL_MAP: Record<string, string> = {
  "Sobre Wee": "Sobre Wee",
  "Qué es Wee": "Que é Wee",
  "Cómo funciona": "Como funciona",
  "Calidad del contenido": "Calidade do contido",
  "Cerrar": "Pechar",
  "Entrar": "Entrar",
  "Entrar con usuario existente": "Entrar cun usuario existente",
  "Tu alias (opcional)": "O teu alias (opcional)",
  "Foto de perfil (opcional)": "Imaxe de perfil (opcional)",
  "Idioma del perfil": "Idioma do perfil",
  "Perfil": "Perfil",
  "Mis publicaciones": "As miñas publicacións",
  "Ajustes": "Axustes",
  "Preferencias": "Preferencias",
  "microcomunidad": "microcomunidade",
  "Compartir enlace": "Compartir ligazón",
  "Comparte un enlace": "Comparte unha ligazón",
  "Publicar": "Publicar",
  "Publicar en Wee": "Publicar en Wee",
  "Publicando...": "Publicando...",
  "Comentarios": "Comentarios",
  "Publicadas": "Publicadas",
  "Mejor calidad": "Mellor calidade",
  "Más Aura": "Máis Aura",
  "Aplicar": "Aplicar",
  "Guardar": "Gardar",
  "Guardar preferencias": "Gardar preferencias",
  "Volver": "Volver",
  "Volver al inicio": "Volver ao inicio",
  "Abrir fuente": "Abrir fonte",
  "No hay resumen disponible.": "Non hai resumo dispoñible.",
  "No hay noticias en esta vista": "Non hai novas nesta vista",
  "Noticia no encontrada": "Nova non atopada",
  "Contexto del tema": "Contexto do tema",
  "Ir al tema": "Ir ao tema",
  "Más en este hilo": "Máis neste fío",
  "Hilo": "Fío",
  "Noticias de la comunidad": "Novas da comunidade",
  "Temas activos": "Temas activos",
  "Colaboradores destacados": "Colaboradores destacados",
  "Primeros 3 pasos": "Primeiros 3 pasos",
  "Listo": "Feito",
  "Compartir": "Compartir",
  "Hilo caliente": "Fío quente",
  "Hilo picante": "Fío picante",
  "En movimiento": "En movemento",
  "Muy reciente": "Moi recente",
  "Nivel de recencia": "Nivel de recencia",
  "Para ti": "Para ti",
  "Abrir tema": "Abrir tema",
  "Ver mi perfil": "Ver o meu perfil",
  "Aún no hay publicaciones": "Aínda non hai publicacións",
  "Compartir ahora": "Compartir agora",
  "Resumen": "Resumo",
  "Respaldo de tus datos": "Respaldo dos teus datos",
  "Exportar copia": "Exportar copia",
  "Importar copia": "Importar copia",
  "Ruido del feed": "Ruído do feed",
  "Abierto": "Aberto",
  "Equilibrado": "Equilibrado",
  "Estricto": "Estrito",
  "Añadir": "Engadir",
  "Fuentes que no quieres ver": "Fontes que non queres ver",
  "Palabras para filtrar": "Palabras para filtrar",
  "Qué quieres ver primero": "Que queres ver primeiro",
  "Temas priorizados": "Temas priorizados",
  "Fuentes ocultas": "Fontes ocultas",
  "Palabras filtradas": "Palabras filtradas",
  "Cargando tu espacio local...": "Cargando o teu espazo local...",
  "Copia de seguridad exportada en JSON.": "Copia de seguridade exportada en JSON.",
  "Importación completada. Ya tienes los datos cargados.": "Importación completada. Xa tes os datos cargados.",
  "Inicia sesión para compartir enlaces.": "Inicia sesión para compartir ligazóns.",
  "Inicia sesión para votar.": "Inicia sesión para votar.",
  "Inicia sesión para comentar.": "Inicia sesión para comentar.",
  "Inicia sesión para valorar comentarios.": "Inicia sesión para valorar comentarios.",
  "No encontramos esta noticia.": "Non atopamos esta nova.",
  "No encontramos ese comentario.": "Non atopamos ese comentario.",
  "Antes de votar, abre la fuente.": "Antes de votar, abre a fonte.",
  "Voto guardado. Aura al alza.": "Voto gardado. Aura en subida.",
  "Voto guardado. Aura a la baja.": "Voto gardado. Aura en baixada.",
  "Escribe algo antes de enviar.": "Escribe algo antes de enviar.",
  "Comentario enviado. Hilo actualizado.": "Comentario enviado. Fío actualizado.",
  "Has retirado tu aura.": "Retiraches a túa aura.",
  "Aura enviada. Este comentario gana visibilidad.": "Aura enviada. Este comentario gaña visibilidade.",
  "Comparte con tu gente, crea hilos por tema y filtra mejor lo que merece la pena.": "Comparte coa túa xente, crea fíos por tema e filtra mellor o que paga a pena.",
  "Ej: Alex": "Ex: Alex",
  "Generar alias aleatorio": "Xerar alias aleatorio",
  "Continue": "Continuar",
  "Aún no hay usuarios creados en este navegador.": "Aínda non hai usuarios creados neste navegador.",
  "Cambiar foto": "Cambiar imaxe",
  "Foto de perfil actualizada.": "Imaxe de perfil actualizada.",
  "Foto eliminada. Ahora se muestra tu avatar con iniciales.": "Imaxe eliminada. Agora móstrase o teu avatar coas iniciais.",
  "Quitar foto": "Quitar imaxe",
  "Alias actualizado.": "Alias actualizado.",
  "Alias (opcional)": "Alias (opcional)",
  "Tu alias visible": "O teu alias visible",
  "Ver publicaciones": "Ver publicacións",
  "Cerrar sesión": "Pechar sesión",
  "Puede que se haya eliminado o que se haya fusionado con un duplicado.": "Pode que se eliminase ou se fusionase cun duplicado.",
  "Publicado por": "Publicado por",
  "Tu navegador bloqueó la pestaña. Activa las ventanas emergentes para esta web.": "O teu navegador bloqueou a pestana. Activa as xanelas emerxentes para esta web.",
  "Fuente abierta. Ya puedes valorar esta noticia.": "Fonte aberta. Xa podes valorar esta nova.",
  "Esta noticia no tiene URL externa.": "Esta nova non ten URL externa.",
  "Abre la fuente para poder votar esta noticia.": "Abre a fonte para poder votar esta nova.",
  "Gracias por comprobar la fuente.": "Grazas por comprobar a fonte.",
  "Cómo se calcula su puntuación": "Como se calcula a súa puntuación",
  "Timeline del tema, ordenado por relevancia, Aura comunitaria y actualidad.": "Timeline do tema, ordenado por relevancia, Aura comunitaria e actualidade.",
  "Aún no hay publicaciones en este hilo": "Aínda non hai publicacións neste fío",
  "Comparte la primera noticia para arrancarlo.": "Comparte a primeira nova para arrincalo.",
  "Relevancia del tema": "Relevancia do tema",
  "Abre un hilo nuevo o suma contexto a uno que ya está vivo.": "Abre un fío novo ou engade contexto a un que xa está activo.",
  "Destaca": "Destaca",
  "usuarios activos": "usuarios activos",
  "contenido útil": "contido útil",
  "publicaciones": "publicacións",
  "valoraciones": "valoracións",
  "colaborativas": "colaborativas",
  "Aquí compartís por intereses comunes: hilos por tema, menos ruido y más contexto útil.": "Aquí compartides por intereses comúns: fíos por tema, menos ruído e máis contexto útil.",
  "Comparte la primera noticia y abre el primer hilo de tu comunidad.": "Comparte a primeira nova e abre o primeiro fío da túa comunidade.",
  "Cada tema funciona como un hilo: misma conversación, mismo contexto y menos duplicados.": "Cada tema funciona como un fío: mesma conversa, mesmo contexto e menos duplicados.",
  "Se ordena por constancia y por cuántas publicaciones acaban siendo útiles para la comunidad.": "Ordénase por constancia e por cantas publicacións acaban sendo útiles para a comunidade.",
  "aportes": "achegas",
  "de alta calidad": "de alta calidade",
  "nivel": "nivel",
  "Buscar por tema o palabra": "Buscar por tema ou palabra",
  "Buscar tema, palabra o fuente...": "Buscar tema, palabra ou fonte...",
  "Menú de perfil": "Menú de perfil",
  "Cuenta": "Conta",
  "Aura": "Aura",
  "Pega una URL para compartir.": "Pega unha URL para compartir.",
  "Wee lo coloca en su tema y lo valora para separar señal de ruido.": "Wee colócao no seu tema e valórao para separar sinal de ruído.",
  "Añade contexto, corrige un dato o comparte una fuente...": "Engade contexto, corrixe un dato ou comparte unha fonte...",
  "Aún no hay comentarios.": "Aínda non hai comentarios.",
  "usuario": "usuario",
  "Comparte un enlace y Wee lo coloca en su hilo por tema.": "Comparte unha ligazón e Wee colócao no seu fío por tema.",
  "Revisa la fuente y vota para priorizar lo más útil.": "Revisa a fonte e vota para priorizar o máis útil.",
  "Añade contexto en comentarios para ayudar al grupo.": "Engade contexto nos comentarios para axudar ao grupo.",
  "Noticia compartida": "Nova compartida",
  "Ya habías compartido este enlace. No creamos otro hilo y se aplica una penalización interna.": "Xa compartiras esta ligazón. Non creamos outro fío e aplícase unha penalización interna.",
  "Hazlo simple: elige qué te interesa y cuánto ruido quieres quitar.": "Faino simple: escolle que che interesa e canto ruído queres quitar.",
  "Marca temas y te los subimos al inicio.": "Marca temas e subímolos ao inicio.",
  "Aún no hay temas detectados. Comparte algunas noticias y aparecerán aquí.": "Aínda non hai temas detectados. Comparte algunhas novas e aparecerán aquí.",
  "Añadir temas (ej: salud, ciencia)": "Engadir temas (ex: saúde, ciencia)",
  "Idioma de la app": "Idioma da app",
  "Elige el idioma de la interfaz para tu perfil.": "Escolle o idioma da interface para o teu perfil.",
  "Preferencias guardadas.": "Preferencias gardadas.",
  "Idioma actualizado.": "Idioma actualizado.",
  "Elige un modo rápido. Luego puedes retocar debajo.": "Escolle un modo rápido. Despois podes axustar debaixo.",
  "Ves casi todo.": "Ves case todo.",
  "Reduce ruido sin pasarse.": "Reduce ruído sen pasarse.",
  "Filtra fuerte: solo lo más limpio.": "Filtra forte: só o máis limpo.",
  "Añadir dominios (ej: ejemplo.com)": "Engadir dominios (ex: exemplo.com)",
  "Añadir palabras (ej: bulo, rumor)": "Engadir palabras (ex: bulo, rumor)",
  "Exporta o importa tu contenido local cuando quieras.": "Exporta ou importa o teu contido local cando queiras.",
  "Pásalo por Wee para que quede en su tema, con contexto y sin duplicados.": "Pásao por Wee para que quede no seu tema, con contexto e sen duplicados.",
  "Tip: si se comparte aquí primero, el grupo lo debate en su hilo y no se pierde contexto.": "Consello: se se comparte aquí primeiro, o grupo debáteo no seu fío e non se perde contexto.",
  "Wee · comparte aquí primero y decide mejor en comunidad": "Wee · comparte aquí primeiro e decide mellor en comunidade",
  "Wee está hecha para microcomunidades: intereses comunes, hilos por tema y filtro real de calidad.": "Wee está feita para microcomunidades: intereses comúns, fíos por tema e filtro real de calidade.",
  "Wee es un espacio para grupos pequeños con intereses compartidos. Aquí no se pierden enlaces: quedan agrupados por tema y listos para seguir el hilo.": "Wee é un espazo para grupos pequenos con intereses compartidos. Aquí non se perden ligazóns: quedan agrupadas por tema e listas para seguir o fío.",
  "Compartes un enlace, Wee lo clasifica por tema y subtema, evita duplicados y suma comentarios con Aura. Así se construyen hilos claros y se mantiene el contexto dentro de la comunidad.": "Compartes unha ligazón, Wee clasifícaa por tema e subtema, evita duplicados e suma comentarios con Aura. Así constrúense fíos claros e mantense o contexto dentro da comunidade.",
  "Usamos reglas claras: reputación de la fuente, señales de evidencia, detección de titulares gancho, actualidad y valoración del grupo. Así sube lo útil y se marca lo dudoso.": "Usamos regras claras: reputación da fonte, sinais de evidencia, detección de titulares gancho, actualidade e valoración do grupo. Así sobe o útil e márcase o dubidoso.",
  "Publicaciones en este tema": "Publicacións neste tema",
  "Última actualización": "Última actualización",
  "Mostrar menos": "Mostrar menos",
  "Ver últimas del hilo": "Ver últimas do fío",
  "Muévete por Wee": "Móvete por Wee",
  "Temas": "Temas",
  "Noticias": "Novas",
  "Comunidad": "Comunidade",
  "Lo más útil y comentado por la comunidad en este momento.": "O máis útil e comentado pola comunidade neste momento.",
  "Noticias recientes": "Novas recentes",
  "Ya habías compartido este enlace. Lo mantenemos en el mismo hilo para no duplicar y mantener el contexto.": "Xa compartiras esta ligazón. Mantémola no mesmo fío para evitar duplicados e manter o contexto."
  ,
  "Entra para compartir links.": "Entra para compartir ligazóns.",
  "Ese link ya lo habías compartido. Lo dejamos en el mismo hilo para mantener orden y contexto.": "Esa ligazón xa a compartiras. Deixámola no mesmo fío para manter orde e contexto.",
  "Ese link ya existía: lo sumamos al mismo hilo (": "Esa ligazón xa existía: sumámola ao mesmo fío (",
  "Entra para votar.": "Entra para votar.",
  "Voto guardado. Aura subiendo.": "Voto gardado. Aura en subida.",
  "Voto guardado. Aura bajando.": "Voto gardado. Aura en baixada.",
  "Entra para comentar.": "Entra para comentar.",
  "Comentario enviado. Hilo al día.": "Comentario enviado. Fío ao día.",
  "Entra para valorar comentarios.": "Entra para valorar comentarios.",
  "Aura enviada. Este comentario sube un poco.": "Aura enviada. Este comentario sobe un pouco.",
  "Esta acción es solo para admin.": "Esta acción é só para admin.",
  "Entra para reportar.": "Entra para reportar.",
  "Cuéntanos un motivo breve.": "Cóntanos un motivo breve.",
  "Cargando tu comunidad...": "Cargando a túa comunidade...",
  "Error de conexión con el backend": "Erro de conexión co backend",
  "Comentario eliminado.": "Comentario eliminado.",
  "Noticia eliminada.": "Nova eliminada.",
  "Reporte enviado. Gracias por cuidar la comunidad.": "Reporte enviado. Grazas por coidar a comunidade.",
  "No pudimos enviar el reporte ahora.": "Non puidemos enviar o reporte agora.",
  "Publicación reactivada.": "Publicación reactivada.",
  "Publicación colapsada.": "Publicación colapsada.",
  "Publicación retirada.": "Publicación retirada.",
  "Tema no válido.": "Tema non válido.",
  "Tema de noticia actualizado.": "Tema da nova actualizado.",
  "Entra para editar temas.": "Entra para editar temas.",
  "Ese tema ya está añadido.": "Ese tema xa está engadido.",
  "Tema añadido a la noticia.": "Tema engadido á nova.",
  "No puedes eliminar tu propio usuario admin.": "Non podes eliminar o teu propio usuario admin.",
  "Política de invitación": "Política de invitación"
};

const toGalician = (es: string): string => GL_MAP[es] ?? es;

export const pick = (language: AppLanguage, es: string, en: string, gl?: string): string => {
  if (language === "en") return en;
  if (language === "gl") return gl ?? toGalician(es);
  return es;
};

export const translateRankTitle = (language: AppLanguage, value: string): string => {
  if (language === "gl") {
    const map: Record<string, string> = {
      Leyenda: "Lenda",
      "Élite": "Élite",
      "Curador Pro": "Curador Pro",
      Colaborador: "Colaborador",
      Inicial: "Inicial"
    };
    return map[value] ?? value;
  }
  if (language !== "en") return value;
  const map: Record<string, string> = {
    Leyenda: "Legend",
    "Élite": "Elite",
    "Curador Pro": "Pro Curator",
    Colaborador: "Contributor",
    Inicial: "Starter"
  };
  return map[value] ?? value;
};

export const translateBadge = (language: AppLanguage, value: string): string => {
  if (language === "gl") {
    const map: Record<string, string> = {
      "Fuente fiable": "Fonte fiable",
      "Constructor de comunidad": "Construtor de comunidade",
      "Pulso comunitario": "Pulso comunitario",
      "Señal fiable": "Sinal fiable"
    };
    return map[value] ?? value;
  }
  if (language !== "en") return value;
  const map: Record<string, string> = {
    "Fuente fiable": "Reliable source",
    "Constructor de comunidad": "Community builder",
    "Pulso comunitario": "Community pulse",
    "Señal fiable": "Reliable signal"
  };
  return map[value] ?? value;
};

export const translateRationale = (language: AppLanguage, value: string): string => {
  if (language === "gl") {
    const topicMatch = value.match(/^Tema "(.+)" detectado con señal ([\d.]+)\.?$/);
    if (topicMatch) {
      return `Tema "${topicMatch[1]}" detectado con sinal ${topicMatch[2]}.`;
    }
    const map: Record<string, string> = {
      "Incluye enlace a una fuente.": "Inclúe ligazón a unha fonte.",
      "La fuente usa HTTPS.": "A fonte usa HTTPS.",
      "La fuente no usa HTTPS.": "A fonte non usa HTTPS.",
      "Falta enlace a la fuente.": "Falta ligazón á fonte.",
      "Fuente de alta reputación (nivel A).": "Fonte de alta reputación (nivel A).",
      "Fuente consolidada (nivel B).": "Fonte consolidada (nivel B).",
      "Fuente en red social, pero con contexto adicional.": "Fonte en rede social, pero con contexto adicional.",
      "Fuente en red social.": "Fonte en rede social.",
      "El título tiene longitud informativa.": "O título ten lonxitude informativa.",
      "El título es demasiado corto para informar.": "O título é demasiado curto para informar.",
      "El título es excesivamente largo.": "O título é excesivamente longo.",
      "El texto aporta contexto suficiente.": "O texto achega contexto suficiente.",
      "El texto es demasiado corto para validar contexto.": "O texto é demasiado curto para validar contexto.",
      "El texto aporta poco contexto.": "O texto achega pouco contexto.",
      "Publicación muy corta y sin título.": "Publicación moi curta e sen título.",
      "Incluye números o fechas.": "Inclúe números ou datas.",
      "Incluye cita con atribución.": "Inclúe cita con atribución.",
      "Incluye afirmaciones no verificadas.": "Inclúe afirmacións non verificadas.",
      "La puntuación excesiva reduce fiabilidad.": "A puntuación excesiva reduce a fiabilidade.",
      "Señales fuertes de clickbait o sensacionalismo.": "Sinais fortes de clickbait ou sensacionalismo.",
      "Se detecta un tono sensacionalista moderado.": "Detéctase un ton sensacionalista moderado.",
      "Aura limitada por señales de clickbait.": "Aura limitada por sinais de clickbait.",
      "Aura calculada por tema, calidad, actualidad y contexto.": "Aura calculada por tema, calidade, actualidade e contexto.",
      "Enlace repetido por el mismo usuario; se aplica penalización interna": "Ligazón repetida polo mesmo usuario; aplícase penalización interna."
    };
    return map[value] ?? value;
  }
  if (language !== "en") return value;
  const topicMatch = value.match(/^Tema "(.+)" detectado con señal ([\d.]+)\.?$/);
  if (topicMatch) {
    return `Topic "${topicMatch[1]}" detected with signal ${topicMatch[2]}.`;
  }
  const map: Record<string, string> = {
    "Incluye enlace a una fuente.": "Includes a source link.",
    "La fuente usa HTTPS.": "The source uses HTTPS.",
    "La fuente no usa HTTPS.": "The source does not use HTTPS.",
    "Falta enlace a la fuente.": "Missing source link.",
    "Fuente de alta reputación (nivel A).": "High-reputation source (tier A).",
    "Fuente consolidada (nivel B).": "Established source (tier B).",
    "Fuente en red social, pero con contexto adicional.": "Social source, but with additional context.",
    "Fuente en red social.": "Social source.",
    "El título tiene longitud informativa.": "Title has informative length.",
    "El título es demasiado corto para informar.": "Title is too short to inform.",
    "El título es excesivamente largo.": "Title is too long.",
    "El texto aporta contexto suficiente.": "Text provides enough context.",
    "El texto es demasiado corto para validar contexto.": "Text is too short to validate context.",
    "El texto aporta poco contexto.": "Text provides limited context.",
    "Publicación muy corta y sin título.": "Very short post without title.",
    "Incluye números o fechas.": "Includes numbers or dates.",
    "Incluye cita con atribución.": "Includes quote with attribution.",
    "Incluye afirmaciones no verificadas.": "Includes unverified claims.",
    "La puntuación excesiva reduce fiabilidad.": "Excessive punctuation lowers reliability.",
    "Señales fuertes de clickbait o sensacionalismo.": "Strong clickbait or sensationalism signals.",
    "Se detecta un tono sensacionalista moderado.": "Moderate sensationalist tone detected.",
    "Aura limitada por señales de clickbait.": "Aura capped due to clickbait signals.",
    "Aura calculada por tema, calidad, actualidad y contexto.": "Aura calculated by topic, quality, recency and context.",
    "Enlace repetido por el mismo usuario; se aplica penalización interna": "Link repeated by the same user; internal penalty applied."
  };
  return map[value] ?? value;
};

export const I18nContext = createContext<I18nValue>({
  language: "es"
});

export const useI18n = (): I18nValue => useContext(I18nContext);
