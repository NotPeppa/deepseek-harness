/** `attention` namespace dictionaries. */

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  'row.title': '浏览器通知',
  'row.description': '审批或提问等你处理时，即使标签页在后台也会提醒你。',
  'row.permission': '这个浏览器还没有通知权限，打开开关即可申请。',
  'row.denied': '浏览器拒绝了通知权限，请在站点设置中允许后重试。',
  'row.unsupported': '当前浏览器不支持通知。',
  'row.failed': '通知设置没有保存成功。',
  'notice.approval': '需要你审批',
  'notice.question': '等待你的回答',
  'notice.planReview': '计划等待确认',
  'notice.generic': '需要你处理',
  'notice.session': '会话：{title}',
  'notice.body': '点击返回 DeepSeek Harness 处理',
} satisfies Record<string, string>

/** Attention dictionary key union. */
export type AttentionKey = keyof typeof zh

/** English dictionary, checked against the Chinese key set. */
export const en = {
  'row.title': 'Browser notifications',
  'row.description': 'Get a notification when an approval or question waits for you, even in a background tab.',
  'row.permission': 'This browser has not granted notifications yet; turning the switch on asks for permission.',
  'row.denied': 'The browser blocked notifications. Allow them for this site, then try again.',
  'row.unsupported': 'This browser cannot show notifications.',
  'row.failed': 'The notification setting was not saved.',
  'notice.approval': 'Approval needed',
  'notice.question': 'Waiting for your answer',
  'notice.planReview': 'Plan awaiting confirmation',
  'notice.generic': 'Needs your attention',
  'notice.session': 'Session: {title}',
  'notice.body': 'Click to return to DeepSeek Harness',
} satisfies Record<AttentionKey, string>

/** Japanese copy, checked against the English keys. */
export const ja = {
  'row.title': 'ブラウザ通知',
  'row.description': '承認や回答が待っているとき、タブが背面にあっても通知します。',
  'row.permission': 'このブラウザはまだ通知を許可していません。スイッチを入れると許可を求めます。',
  'row.denied': 'ブラウザが通知をブロックしました。サイト設定で許可してから再試行してください。',
  'row.unsupported': 'このブラウザは通知を表示できません。',
  'row.failed': '通知設定を保存できませんでした。',
  'notice.approval': '承認が必要です',
  'notice.question': '回答を待っています',
  'notice.planReview': 'プランの確認待ち',
  'notice.generic': '対応が必要です',
  'notice.session': 'セッション：{title}',
  'notice.body': 'クリックして DeepSeek Harness に戻る',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'row.title': 'Notificaciones del navegador',
  'row.description': 'Recibe una notificación cuando una aprobación o pregunta te espere, incluso en una pestaña en segundo plano.',
  'row.permission': 'Este navegador aún no concede notificaciones; al activar el interruptor se solicita el permiso.',
  'row.denied': 'El navegador bloqueó las notificaciones. Permítelas para este sitio y vuelve a intentarlo.',
  'row.unsupported': 'Este navegador no puede mostrar notificaciones.',
  'row.failed': 'La preferencia de notificaciones no se guardó.',
  'notice.approval': 'Se necesita aprobación',
  'notice.question': 'Esperando tu respuesta',
  'notice.planReview': 'Plan pendiente de confirmación',
  'notice.generic': 'Requiere tu atención',
  'notice.session': 'Sesión: {title}',
  'notice.body': 'Haz clic para volver a DeepSeek Harness',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'row.title': 'Notifications du navigateur',
  'row.description': "Recevez une notification lorsqu'une approbation ou une question vous attend, même dans un onglet en arrière-plan.",
  'row.permission': "Ce navigateur n'a pas encore accordé les notifications ; activer l'interrupteur demande l'autorisation.",
  'row.denied': 'Le navigateur a bloqué les notifications. Autorisez-les pour ce site, puis réessayez.',
  'row.unsupported': 'Ce navigateur ne peut pas afficher de notifications.',
  'row.failed': "La préférence de notification n'a pas été enregistrée.",
  'notice.approval': 'Approbation requise',
  'notice.question': 'En attente de votre réponse',
  'notice.planReview': 'Plan en attente de confirmation',
  'notice.generic': 'Nécessite votre attention',
  'notice.session': 'Session : {title}',
  'notice.body': 'Cliquez pour revenir à DeepSeek Harness',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'row.title': 'Browser-Benachrichtigungen',
  'row.description': 'Erhalte eine Benachrichtigung, wenn eine Freigabe oder Frage auf dich wartet – auch in einem Hintergrund-Tab.',
  'row.permission': 'Dieser Browser hat Benachrichtigungen noch nicht erlaubt; der Schalter fragt die Berechtigung ab.',
  'row.denied': 'Der Browser hat Benachrichtigungen blockiert. Erlaube sie für diese Seite und versuche es erneut.',
  'row.unsupported': 'Dieser Browser kann keine Benachrichtigungen anzeigen.',
  'row.failed': 'Die Benachrichtigungseinstellung wurde nicht gespeichert.',
  'notice.approval': 'Freigabe erforderlich',
  'notice.question': 'Warte auf deine Antwort',
  'notice.planReview': 'Plan wartet auf Bestätigung',
  'notice.generic': 'Erfordert deine Aufmerksamkeit',
  'notice.session': 'Sitzung: {title}',
  'notice.body': 'Klicke, um zu DeepSeek Harness zurückzukehren',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'row.title': 'Уведомления браузера',
  'row.description': 'Получайте уведомление, когда вас ждёт подтверждение или вопрос, даже во фоновой вкладке.',
  'row.permission': 'Этот браузер ещё не разрешил уведомления; включение переключателя запросит разрешение.',
  'row.denied': 'Браузер заблокировал уведомления. Разрешите их для этого сайта и повторите попытку.',
  'row.unsupported': 'Этот браузер не может показывать уведомления.',
  'row.failed': 'Настройка уведомлений не сохранена.',
  'notice.approval': 'Требуется подтверждение',
  'notice.question': 'Ожидается ваш ответ',
  'notice.planReview': 'План ожидает подтверждения',
  'notice.generic': 'Требуется ваше внимание',
  'notice.session': 'Сеанс: {title}',
  'notice.body': 'Нажмите, чтобы вернуться в DeepSeek Harness',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'row.title': 'Notificações do navegador',
  'row.description': 'Receba uma notificação quando uma aprovação ou pergunta esperar por você, mesmo em uma aba em segundo plano.',
  'row.permission': 'Este navegador ainda não concedeu notificações; ligar o interruptor solicita a permissão.',
  'row.denied': 'O navegador bloqueou as notificações. Permita-as para este site e tente novamente.',
  'row.unsupported': 'Este navegador não pode mostrar notificações.',
  'row.failed': 'A preferência de notificações não foi salva.',
  'notice.approval': 'Aprovação necessária',
  'notice.question': 'Aguardando sua resposta',
  'notice.planReview': 'Plano aguardando confirmação',
  'notice.generic': 'Precisa da sua atenção',
  'notice.session': 'Sessão: {title}',
  'notice.body': 'Clique para voltar ao DeepSeek Harness',
} satisfies Record<keyof typeof en, string>
