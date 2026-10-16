import type { Dictionary } from "@huambo-online/core";

/** Textos da área «admin» (Site). */
export const DICT_ADMIN: Dictionary = {
  // Separadores
  "ad.tab.stats": { pt: "Estatísticas", en: "Statistics", zh: "统计" },
  "ad.tab.reports": { pt: "Denúncias", en: "Reports", zh: "举报" },
  "ad.tab.revenue": { pt: "Receitas", en: "Revenue", zh: "收入" },
  "ad.tab.protected": { pt: "Pagamento protegido", en: "Protected payment", zh: "担保付款" },
  "ad.tab.plans": { pt: "Mensalidades e comissões", en: "Subscriptions and commissions", zh: "月费与佣金" },
  "ad.tab.safety": { pt: "Segurança", en: "Safety", zh: "安全" },
  "ad.tab.agents": { pt: "Agentes", en: "Agents", zh: "代理人" },
  "ad.tab.events": { pt: "Eventos", en: "Events", zh: "活动" },
  "ad.tab.videos": { pt: "Vídeos", en: "Videos", zh: "视频" },
  "ad.tab.fuel": { pt: "Combustível", en: "Fuel", zh: "燃油" },
  "ad.tab.venues": { pt: "🏨 Reservas", en: "🏨 Bookings", zh: "🏨 预订" },
  "ad.tab.inspections": { pt: "Inspeções", en: "Inspections", zh: "检验" },
  "ad.tab.disputes": { pt: "Disputas", en: "Disputes", zh: "纠纷" },
  "ad.tab.verifications": { pt: "Verificações", en: "Verifications", zh: "认证" },
  "ad.tab.listings": { pt: "Anúncios", en: "Listings", zh: "广告" },
  "ad.tab.users": { pt: "Utilizadores", en: "Users", zh: "用户" },
  "ad.tab.categories": { pt: "Categorias", en: "Categories", zh: "类别" },
  "ad.tab.couriers": { pt: "Estafetas", en: "Couriers", zh: "配送员" },
  "ad.tab.markets": { pt: "Praças", en: "Markets", zh: "市场" },
  "ad.tab.audit": { pt: "Registo", en: "Log", zh: "日志" },

  // Entrada em dois passos
  "ad.mfa_intro": {
    pt: "A sua conta tem a entrada em dois passos ligada. Para abrir a administração, escreva o código da APP autenticadora.",
    en: "Your account has two-step sign-in turned on. To open the administration, enter the code from your authenticator app.",
    zh: "您的账户已开启两步登录。要打开管理后台，请输入身份验证器应用中的验证码。"
  },
  "ad.mfa_on_label": { pt: "Entrada em dois passos:", en: "Two-step sign-in:", zh: "两步登录：" },
  "ad.mfa_on": { pt: "ligada ✔", en: "on ✔", zh: "已开启 ✔" },
  "ad.mfa_manage": { pt: "Gerir", en: "Manage", zh: "管理" },
  "ad.mfa_off_title": { pt: "Entrar em dois passos", en: "Two-step sign-in", zh: "两步登录" },
  "ad.mfa_off_text": {
    pt: "Recomendado para administradores: proteja esta conta com um código da APP autenticadora.",
    en: "Recommended for administrators: protect this account with a code from an authenticator app.",
    zh: "建议管理员开启：用身份验证器应用的验证码保护此账户。"
  },
  "ad.mfa_turn_on": { pt: "Ligar agora", en: "Turn on now", zh: "立即开启" },

  // Geral
  "ad.no_access": { pt: "Acesso reservado à administração.", en: "Access restricted to administrators.", zh: "仅限管理员访问。" },
  "ad.role": { pt: "Papel", en: "Role", zh: "角色" },
  "ad.status": { pt: "Estado", en: "Status", zh: "状态" },
  "ad.all_f": { pt: "Todas", en: "All", zh: "全部" },
  "ad.all_m": { pt: "Todos", en: "All", zh: "全部" },
  "ad.all_statuses": { pt: "Todos os estados", en: "All statuses", zh: "所有状态" },
  "ad.refresh": { pt: "Atualizar", en: "Refresh", zh: "刷新" },
  "ad.search": { pt: "Pesquisar", en: "Search", zh: "搜索" },
  "ad.view": { pt: "Ver", en: "View", zh: "查看" },
  "ad.hide": { pt: "Esconder", en: "Hide", zh: "隐藏" },
  "ad.show": { pt: "Mostrar", en: "Show", zh: "显示" },
  "ad.approve": { pt: "Aprovar", en: "Approve", zh: "批准" },
  "ad.reject": { pt: "Recusar", en: "Reject", zh: "拒绝" },
  "ad.suspend": { pt: "Suspender", en: "Suspend", zh: "暂停" },
  "ad.add": { pt: "Adicionar", en: "Add", zh: "添加" },
  "ad.create": { pt: "Criar", en: "Create", zh: "创建" },
  "ad.choose": { pt: "Escolha…", en: "Choose…", zh: "请选择…" },
  "ad.no_name": { pt: "(sem nome)", en: "(no name)", zh: "（无名称）" },

  // Denúncias
  "ad.no_reports": { pt: "Sem denúncias.", en: "No reports.", zh: "暂无举报。" },
  "ad.gone": { pt: "(já não existe)", en: "(no longer exists)", zh: "（已不存在）" },
  "ad.hidden": { pt: "escondido", en: "hidden", zh: "已隐藏" },
  "ad.reason": { pt: "Motivo", en: "Reason", zh: "原因" },
  "ad.reported_by": { pt: "Denunciado por {name}", en: "Reported by {name}", zh: "举报人：{name}" },
  "ad.a_user": { pt: "utilizador", en: "user", zh: "用户" },
  "ad.remove_listing": { pt: "Retirar anúncio", en: "Remove listing", zh: "下架广告" },
  "ad.show_again": { pt: "Voltar a mostrar", en: "Show again", zh: "重新显示" },
  "ad.suspend_account": { pt: "Suspender conta", en: "Suspend account", zh: "暂停账户" },
  "ad.resolved": { pt: "Resolvida", en: "Resolved", zh: "已解决" },
  "ad.dismiss": { pt: "Rejeitar", en: "Dismiss", zh: "驳回" },
  "ad.confirm_suspend_account": { pt: "Suspender esta conta?", en: "Suspend this account?", zh: "要暂停此账户吗？" },
  "ad.ok_listing_removed_resolved": { pt: "Anúncio retirado e denúncia resolvida.", en: "Listing removed and report resolved.", zh: "广告已下架，举报已解决。" },
  "ad.ok_hidden_resolved": { pt: "Escondido e denúncia resolvida.", en: "Hidden and report resolved.", zh: "已隐藏，举报已解决。" },
  "ad.ok_shown_again": { pt: "Voltou a aparecer.", en: "Visible again.", zh: "已重新显示。" },
  "ad.ok_account_suspended_resolved": { pt: "Conta suspensa e denúncia resolvida.", en: "Account suspended and report resolved.", zh: "账户已暂停，举报已解决。" },
  "ad.ok_report_resolved": { pt: "Denúncia resolvida.", en: "Report resolved.", zh: "举报已解决。" },
  "ad.ok_report_dismissed": { pt: "Denúncia rejeitada.", en: "Report dismissed.", zh: "举报已驳回。" },

  // Anúncios
  "ad.search_title": { pt: "Pesquisar título", en: "Search title", zh: "搜索标题" },
  "ad.reports_one": { pt: "{n} denúncia", en: "{n} report", zh: "{n} 条举报" },
  "ad.reports_many": { pt: "{n} denúncias", en: "{n} reports", zh: "{n} 条举报" },
  "ad.reports_none": { pt: "sem denúncias", en: "no reports", zh: "无举报" },
  "ad.remove": { pt: "Retirar", en: "Remove", zh: "下架" },
  "ad.publish": { pt: "Publicar", en: "Publish", zh: "发布" },
  "ad.feature": { pt: "Destacar", en: "Feature", zh: "设为推荐" },
  "ad.unfeature": { pt: "Tirar destaque", en: "Remove feature", zh: "取消推荐" },
  "ad.ok_listing_removed": { pt: "Anúncio retirado.", en: "Listing removed.", zh: "广告已下架。" },
  "ad.ok_listing_published": { pt: "Anúncio publicado.", en: "Listing published.", zh: "广告已发布。" },
  "ad.ok_featured": { pt: "Anúncio em destaque.", en: "Listing featured.", zh: "广告已设为推荐。" },
  "ad.ok_unfeatured": { pt: "Destaque removido.", en: "Feature removed.", zh: "已取消推荐。" },

  // Utilizadores
  "ad.name_or_email": { pt: "Nome ou email", en: "Name or email", zh: "姓名或邮箱" },
  "ad.listings_one": { pt: "{n} anúncio", en: "{n} listing", zh: "{n} 条广告" },
  "ad.listings_many": { pt: "{n} anúncios", en: "{n} listings", zh: "{n} 条广告" },
  "ad.since": { pt: "desde {date}", en: "since {date}", zh: "自 {date} 起" },
  "ad.reactivate": { pt: "Reativar", en: "Reactivate", zh: "重新启用" },
  "ad.confirm_suspend_user": {
    pt: "Suspender este utilizador? Os anúncios dele ficam pausados.",
    en: "Suspend this user? Their listings will be paused.",
    zh: "要暂停此用户吗？其广告将被暂停。"
  },
  "ad.ok_user_suspended": { pt: "Utilizador suspenso.", en: "User suspended.", zh: "用户已暂停。" },
  "ad.ok_user_reactivated": { pt: "Utilizador reativado.", en: "User reactivated.", zh: "用户已重新启用。" },
  "ad.ok_role_updated": { pt: "Papel atualizado.", en: "Role updated.", zh: "角色已更新。" },

  // Categorias
  "ad.new_category": { pt: "Nova categoria", en: "New category", zh: "新类别" },
  "ad.deactivated_f": { pt: "(desativada)", en: "(deactivated)", zh: "（已停用）" },
  "ad.activate": { pt: "Ativar", en: "Activate", zh: "启用" },
  "ad.deactivate": { pt: "Desativar", en: "Deactivate", zh: "停用" },
  "ad.ok_category_created": { pt: "Categoria criada.", en: "Category created.", zh: "类别已创建。" },
  "ad.ok_category_on": { pt: "Categoria ativada.", en: "Category activated.", zh: "类别已启用。" },
  "ad.ok_category_off": { pt: "Categoria desativada.", en: "Category deactivated.", zh: "类别已停用。" },

  // Estafetas
  "ad.couriers_title": { pt: "Estafetas ({n})", en: "Couriers ({n})", zh: "配送员（{n}）" },
  "ad.couriers_empty": { pt: "Ainda ninguém se registou como estafeta.", en: "Nobody has signed up as a courier yet.", zh: "还没有人注册成为配送员。" },
  "ad.any_municipality": { pt: "Qualquer município", en: "Any municipality", zh: "任意市镇" },
  "ad.delivered_one": { pt: "{n} entrega feita", en: "{n} delivery made", zh: "已完成 {n} 次配送" },
  "ad.delivered_many": { pt: "{n} entregas feitas", en: "{n} deliveries made", zh: "已完成 {n} 次配送" },
  "ad.unavailable": { pt: "indisponível", en: "unavailable", zh: "暂不可用" },
  "ad.confirm_suspend_courier": { pt: "Suspender este estafeta?", en: "Suspend this courier?", zh: "要暂停此配送员吗？" },
  "ad.ok_courier_approved": { pt: "Estafeta aprovado.", en: "Courier approved.", zh: "配送员已批准。" },
  "ad.ok_courier_suspended": { pt: "Estafeta suspenso.", en: "Courier suspended.", zh: "配送员已暂停。" },
  "ad.deliveries_title": { pt: "Entregas em curso ({n})", en: "Deliveries in progress ({n})", zh: "进行中的配送（{n}）" },
  "ad.deliveries_empty": { pt: "Sem entregas em curso.", en: "No deliveries in progress.", zh: "暂无进行中的配送。" },
  "ad.seller": { pt: "Vendedor", en: "Seller", zh: "卖家" },
  "ad.deliver_to": { pt: "Entregar em", en: "Deliver to", zh: "送达地点" },
  "ad.courier": { pt: "Estafeta", en: "Courier", zh: "配送员" },
  "ad.pick_courier": { pt: "Escolher estafeta…", en: "Choose courier…", zh: "选择配送员…" },
  "ad.assign": { pt: "Atribuir", en: "Assign", zh: "分配" },
  "ad.ok_delivery_assigned": { pt: "Entrega atribuída.", en: "Delivery assigned.", zh: "配送已分配。" },

  // Praças
  "ad.markets_title": { pt: "Praças ({n})", en: "Markets ({n})", zh: "市场（{n}）" },
  "ad.market_no_address": { pt: "Sem morada nem horário", en: "No address or opening hours", zh: "无地址和营业时间" },
  "ad.market_edit": { pt: "Editar praça", en: "Edit market", zh: "编辑市场" },
  "ad.market_add": { pt: "Adicionar praça", en: "Add market", zh: "添加市场" },
  "ad.ok_market_visible": { pt: "Praça visível.", en: "Market visible.", zh: "市场已显示。" },
  "ad.ok_market_hidden": { pt: "Praça escondida.", en: "Market hidden.", zh: "市场已隐藏。" },
  "ad.ok_market_updated": { pt: "Praça atualizada.", en: "Market updated.", zh: "市场已更新。" },
  "ad.ok_market_added": { pt: "Praça adicionada.", en: "Market added.", zh: "市场已添加。" },
  "ad.f_name": { pt: "Nome", en: "Name", zh: "名称" },
  "ad.f_name_ph": { pt: "Ex.: Praça do Kapango", en: "E.g.: Praça do Kapango", zh: "例如：Praça do Kapango" },
  "ad.f_municipality": { pt: "Município", en: "Municipality", zh: "市镇" },
  "ad.f_address": { pt: "Bairro / morada", en: "Neighbourhood / address", zh: "街区 / 地址" },
  "ad.f_hours": { pt: "Horário", en: "Opening hours", zh: "营业时间" },
  "ad.f_hours_ph": { pt: "Ex.: Todos os dias, 06:00–18:00", en: "E.g.: Every day, 06:00–18:00", zh: "例如：每天 06:00–18:00" },
  "ad.f_photo": { pt: "Fotografia (endereço https://)", en: "Photo (https:// address)", zh: "照片（https:// 地址）" },
  "ad.f_description": { pt: "Descrição", en: "Description", zh: "描述" },
  "ad.f_description_ph": { pt: "O que se vende, como chegar…", en: "What is sold, how to get there…", zh: "出售什么、如何前往…" },

  // Verificações
  "ad.photo_front": { pt: "BI — frente", en: "ID card — front", zh: "身份证 — 正面" },
  "ad.photo_back": { pt: "BI — verso", en: "ID card — back", zh: "身份证 — 背面" },
  "ad.photo_selfie": { pt: "Selfie com o BI", en: "Selfie with the ID card", zh: "手持身份证自拍" },
  "ad.photo_of": { pt: "{label} de {name}", en: "{label} of {name}", zh: "{name} 的{label}" },
  "ad.view_big": { pt: "Ver em grande: {label}", en: "View large: {label}", zh: "查看大图：{label}" },
  "ad.photos_error": {
    pt: "Não foi possível abrir algumas fotografias. Tente atualizar a página.",
    en: "Some photos could not be opened. Try refreshing the page.",
    zh: "部分照片无法打开。请尝试刷新页面。"
  },
  "ad.doc_error": { pt: "Não foi possível abrir o documento.", en: "The document could not be opened.", zh: "无法打开该文件。" },
  "ad.previous": { pt: "Anterior", en: "Previous", zh: "上一张" },
  "ad.next": { pt: "Seguinte", en: "Next", zh: "下一张" },
  "ad.err_need_reason": {
    pt: "Escolha pelo menos um motivo ou escreva o motivo da recusa.",
    en: "Choose at least one reason or write the reason for rejection.",
    zh: "请至少选择一个原因，或填写拒绝原因。"
  },
  "ad.err_need_checklist": {
    pt: "Confirme todos os pontos da lista antes de aprovar.",
    en: "Confirm every item on the list before approving.",
    zh: "批准前请确认清单上的所有项目。"
  },
  "ad.ok_verif_approved": { pt: "Verificação aprovada.", en: "Verification approved.", zh: "认证已批准。" },
  "ad.ok_verif_rejected": { pt: "Verificação recusada.", en: "Verification rejected.", zh: "认证已拒绝。" },
  "ad.requested_on": { pt: "Pedido em {date}", en: "Requested on {date}", zh: "申请时间：{date}" },
  "ad.account_created_on": { pt: "Conta criada em {date}", en: "Account created on {date}", zh: "账户创建于：{date}" },
  "ad.bi_number": { pt: "Número do BI escrito", en: "ID card number entered", zh: "填写的身份证号码" },
  "ad.prev_rejections_one": {
    pt: "Esta pessoa já teve {n} pedido recusado. Veja com mais atenção.",
    en: "This person has already had {n} request rejected. Check more carefully.",
    zh: "此人已有 {n} 次申请被拒绝。请更仔细地审核。"
  },
  "ad.prev_rejections_many": {
    pt: "Esta pessoa já teve {n} pedidos recusados. Veja com mais atenção.",
    en: "This person has already had {n} requests rejected. Check more carefully.",
    zh: "此人已有 {n} 次申请被拒绝。请更仔细地审核。"
  },
  "ad.note": { pt: "Nota", en: "Note", zh: "备注" },
  "ad.answer": { pt: "Resposta", en: "Reply", zh: "回复" },
  "ad.old_request": {
    pt: "Pedido antigo: só tem um documento (sem verso nem selfie).",
    en: "Old request: it only has one document (no back or selfie).",
    zh: "旧申请：只有一份文件（无背面和自拍）。"
  },
  "ad.view_document": { pt: "Ver documento", en: "View document", zh: "查看文件" },
  "ad.checklist_title": { pt: "Antes de aprovar, confirme:", en: "Before approving, confirm:", zh: "批准前，请确认：" },
  "ad.reject_reason_title": { pt: "Motivo da recusa (a pessoa vai ver)", en: "Reason for rejection (the person will see it)", zh: "拒绝原因（对方会看到）" },
  "ad.other_reason": { pt: "Outro motivo ou explicação", en: "Other reason or explanation", zh: "其他原因或说明" },
  "ad.confirm_reject": { pt: "Confirmar recusa", en: "Confirm rejection", zh: "确认拒绝" },
  "ad.confirm_all_points": { pt: "Confirme todos os pontos da lista", en: "Confirm every item on the list", zh: "请确认清单上的所有项目" },
  "ad.approve_hint": {
    pt: "O botão «Aprovar» fica ativo depois de confirmar os {n} pontos.",
    en: "The “Approve” button becomes active after you confirm all {n} items.",
    zh: "确认全部 {n} 项后，“批准”按钮才可使用。"
  },
  "ad.photos_private": {
    pt: "As fotografias são privadas. As ligações só funcionam durante 10 minutos. Não as partilhe.",
    en: "The photos are private. The links only work for 10 minutes. Do not share them.",
    zh: "这些照片是私密的。链接仅在 10 分钟内有效。请勿分享。"
  },
  "ad.no_verifications": { pt: "Sem pedidos de verificação.", en: "No verification requests.", zh: "暂无认证申请。" },

  // Registo
  "ad.audit_intro": {
    pt: "Tudo o que a administração muda (contas, papéis, denúncias, anúncios, estafetas, categorias, verificações) fica aqui registado.",
    en: "Everything the administration changes (accounts, roles, reports, listings, couriers, categories, verifications) is logged here.",
    zh: "管理员所做的一切更改（账户、角色、举报、广告、配送员、类别、认证）都会记录在这里。"
  },
  "ad.audit_empty": { pt: "Ainda sem registos.", en: "No log entries yet.", zh: "暂无记录。" },
};
