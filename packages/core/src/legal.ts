/**
 * Páginas de informação (iguais no Site e na APP): Termos de Uso, Política de Privacidade,
 * Ajuda (perguntas frequentes) e Como apagar a conta. O texto é simples, em português de Angola.
 * Nota para o dono do projeto: é um texto de base — convém revê-lo com um jurista antes do lançamento.
 */
export type InfoSection = { title: string; paragraphs: string[] };
export type InfoPage = { slug: string; title: string; intro: string; updated: string; sections: InfoSection[] };

export const LEGAL_UPDATED = "2026-11-01";
/** E-mail de contacto público (opcional). Sem e-mail, as páginas indicam a Conta e as Mensagens. */
export function contactLine(email?: string | null): string {
  const e = (email ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
    ? `Pode contactar-nos pelo e-mail ${e}.`
    : "Pode contactar-nos através da sua conta (Conta → Ajuda) ou denunciando o conteúdo em causa.";
}

export function termsPage(email?: string | null): InfoPage {
  return {
    slug: "termos", title: "Termos de Uso", updated: LEGAL_UPDATED,
    intro: "Estas regras valem para o Site e a APP Huambo Online. Ao criar conta ou usar o serviço, aceita estes termos.",
    sections: [
      { title: "1. O que é o Huambo Online", paragraphs: [
        "Um lugar para comprar, vender, trocar e arrendar, encontrar profissionais e empresas, e pedir serviços no Huambo e em Angola.",
        "O Huambo Online liga as pessoas. Os negócios são feitos entre comprador e vendedor (ou cliente e profissional), que são responsáveis pelo que combinam."] },
      { title: "2. A sua conta", paragraphs: [
        "Deve ter pelo menos 18 anos, ou autorização de quem tem a sua responsabilidade.",
        "Os dados da conta devem ser verdadeiros. Guarde bem a sua palavra-passe: tudo o que for feito na sua conta é da sua responsabilidade.",
        "Pode apagar a conta quando quiser (veja «Como apagar a minha conta»)."] },
      { title: "3. Anúncios, produtos e serviços", paragraphs: [
        "Só pode anunciar o que é seu ou o que tem autorização para vender, arrendar, trocar ou prestar.",
        "O título, o preço, as fotografias e a descrição devem corresponder à verdade. Indique se o preço é fixo, negociável, aberto a propostas, leilão ou troca.",
        "Garantia de conformidade: ao publicar, declara que o anúncio descreve o artigo com verdade e por completo, incluindo defeitos e o que falta. Se houver omissão ou erro, quem comprou ou arrendou tem direito a troca, devolução com reembolso ou reembolso (todo ou parte). Pode reclamar até 7 dias depois do negócio, em «Devoluções e reembolsos»; o dono responde em 3 dias e, se recusar ou não responder, a administração decide. Quem não cumprir a decisão pode ter a conta suspensa.",
        "É proibido anunciar: armas, drogas, medicamentos sem autorização, animais protegidos, produtos roubados ou falsificados, documentos, conteúdos sexuais, e tudo o que a lei angolana proíba.",
        "A administração pode esconder ou retirar anúncios, produtos e perfis que não cumpram estas regras, e suspender contas."] },
      { title: "4. Propostas, leilões, trocas e encomendas", paragraphs: [
        "Uma proposta aceite, um lance vencedor ou uma encomenda confirmada é um compromisso entre as duas pessoas. Cumpra o que combinou.",
        "Pode retirar uma proposta enquanto não tiver resposta. Um lance só pode ser retirado com motivo, se faltarem mais de 12 horas para o fim do leilão ou se foi feito há menos de 1 hora; quem retira lances muitas vezes pode ser impedido de licitar.",
        "Nunca pague adiantado a quem não conhece. Prefira encontrar-se num local público, ver o artigo e pagar na entrega.",
        "Nas encomendas da Loja, o comprador pode pedir devolução, reembolso ou troca até 14 dias depois da entrega, e o vendedor deve responder. Veja «Devoluções e reembolsos»."] },
      { title: "5. Mensalidades e comissões", paragraphs: [
        "Os perfis de profissionais e de empresas têm um mês grátis. Depois, pagam uma mensalidade à plataforma: 2 000 Kz por mês para profissionais e 5 000 Kz por mês para empresas (os valores em vigor aparecem em «O meu plano»).",
        "O pagamento é feito por transferência bancária ou Multicaixa Express, com a referência ou o comprovativo, e fica válido quando a administração o confirma.",
        "As Lojas (produtos vendidos na Loja sem empresa) seguem o mesmo critério das empresas: um mês grátis e depois 5 000 Kz por mês. Os produtos de uma empresa ficam cobertos pela mensalidade dessa empresa.",
        "Sem mês grátis nem pagamento em dia, o perfil ou a Loja deixa de aparecer aos clientes, mas não é apagado. Volta a aparecer quando o pagamento é confirmado.",
        "Anúncios classificados não pagam mensalidade: quando um artigo é vendido (incluindo leilões), o vendedor paga à plataforma uma comissão de 5% do valor da venda, no prazo de 7 dias. O mesmo vale para o arrendamento e o aluguer de bens móveis e imóveis: 5% do valor do arrendamento indicado ao marcar «Arrendado», ou do valor total de um pedido de aluguer aceite. Com comissões em atraso não se podem publicar anúncios novos.",
        "Destaques (opcional): o vendedor pode pagar para o anúncio aparecer no topo das listas, com o selo «⭐ Destaque», durante o número de dias indicado (500 Kz por 7 dias, salvo outro valor anunciado). O destaque começa quando a administração confirma o pagamento e termina sozinho no fim do prazo. Não garante a venda."] },
      { title: "6. Pagamento protegido", paragraphs: [
        "Quando estiver disponível, pode escolher o «Pagamento protegido» nas compras da Loja. Paga ao Huambo Online, que guarda o dinheiro e só o entrega ao vendedor depois de o comprador confirmar que recebeu a encomenda.",
        "Se o comprador não confirmar nem reclamar dentro do prazo indicado depois da entrega (3 dias, salvo outro valor anunciado), o dinheiro é entregue ao vendedor. Um pedido de devolução ou reembolso aberto a tempo congela o dinheiro até ser resolvido.",
        "Encomendas protegidas que não são pagas dentro do prazo indicado (48 horas, salvo outro valor anunciado) são canceladas. Os reembolsos de dinheiro ainda guardado são feitos pelo Huambo Online, para o IBAN ou o número Multicaixa Express indicado pelo comprador.",
        "O vendedor recebe as vendas libertadas no seu saldo e pede o levantamento para a sua conta. Os levantamentos são pagos por transferência nos dias anunciados em «O meu saldo». Se houver comissão sobre o pagamento protegido, é mostrada antes de vender e descontada no saldo.",
        "O Huambo Online atua apenas como intermediário tecnológico e de pagamento: não é o vendedor dos produtos nem responde pela sua qualidade, mas segue as regras de devolução descritas em «Devoluções e reembolsos»."] },
      { title: "7. Avaliações e denúncias", paragraphs: [
        "Só quem fez negócio pode avaliar. As avaliações devem ser honestas e sem insultos.",
        "Se vir algo errado, use «Denunciar». A administração analisa as denúncias e pode retirar conteúdos."] },
      { title: "8. Verificação de perfis", paragraphs: [
        "O selo «Verificado» quer dizer que a administração viu um documento. Não é uma garantia sobre a pessoa nem sobre o negócio: continue a ter cuidado."] },
      { title: "9. Responsabilidade", paragraphs: [
        "O Huambo Online faz o possível para manter o serviço a funcionar e seguro, mas não garante que esteja sempre disponível nem responde pelos negócios feitos entre utilizadores.",
        "Estes termos podem mudar. Quando mudarem, a data no topo é atualizada."] },
      { title: "10. Contacto", paragraphs: [contactLine(email)] }
    ]
  };
}

export function privacyPage(email?: string | null): InfoPage {
  return {
    slug: "privacidade", title: "Política de Privacidade", updated: LEGAL_UPDATED,
    intro: "Explicamos que dados guardamos, para quê e quem os pode ver. Seguimos a Lei de Protecção de Dados Pessoais de Angola (Lei n.º 22/11).",
    sections: [
      { title: "1. Que dados guardamos", paragraphs: [
        "Conta: nome, e-mail, telefone (se o indicar), fotografia de perfil, município.",
        "O que publica: anúncios, produtos, fotografias, vídeos, preços, propostas, avaliações e respostas.",
        "Conversas: as mensagens que troca com outras pessoas.",
        "Negócios: encomendas, pedidos de serviço, alugueres, entregas e o histórico de cada um.",
        "Verificação (só se a pedir): a fotografia do documento (BI, alvará ou NIF).",
        "No telemóvel: guardamos no próprio aparelho os anúncios vistos e a última pesquisa, para poder ver sem internet."] },
      { title: "2. Para que usamos os dados", paragraphs: [
        "Para o serviço funcionar: mostrar anúncios, ligar compradores e vendedores, enviar notificações e mensagens, calcular avaliações e números do perfil.",
        "Para segurança: analisar denúncias, verificar perfis e impedir abusos.",
        "Não vendemos os seus dados a ninguém e não mostramos publicidade com base neles."] },
      { title: "3. O que é público", paragraphs: [
        "Os anúncios publicados, produtos, perfis de profissionais e empresas, o seu nome, a fotografia de perfil, as avaliações e os números do perfil (vendas, serviços prestados).",
        "O seu e-mail, telefone, WhatsApp e localização (morada, indicações e ponto no mapa) não são mostrados a outros utilizadores. Só a equipa do Huambo Online (administração e moderadores) os vê. Os outros utilizadores falam consigo pelas Mensagens.",
        "Empresas, postos de combustível, hotéis, restaurantes e eventos mostram os contactos e a localização que indicarem, porque existem para ser encontrados. Pode apagar o seu número de WhatsApp quando quiser."] },
      { title: "4. O que é privado", paragraphs: [
        "Mensagens, propostas, encomendas e pedidos de serviço: só as pessoas envolvidas os veem.",
        "Os documentos de verificação ficam num espaço privado: só o próprio e a administração os podem abrir, através de uma ligação temporária."] },
      { title: "5. Onde ficam os dados e quem nos ajuda", paragraphs: [
        "A base de dados e os ficheiros estão no Supabase, em servidores na União Europeia (Alemanha, Frankfurt).",
        "O Site está alojado na Vercel. A APP é feita com Expo.",
        "Pesquisa por fotografia (quando estiver ativa): a fotografia é enviada ao Claude (Anthropic) para dizer o que é o artigo, e não é guardada por nós."] },
      { title: "6. Quanto tempo guardamos", paragraphs: [
        "Enquanto a conta existir. Os vídeos de anúncios fechados ou vendidos são apagados automaticamente depois de 7 dias, e os de produtos escondidos depois de 30 dias.",
        "Quando apaga a conta, os seus dados são apagados. Algumas cópias de segurança do fornecedor podem durar mais algum tempo até serem substituídas."] },
      { title: "7. Os seus direitos", paragraphs: [
        "Pode ver e corrigir os seus dados em «A sua conta», e apagar anúncios, produtos e a própria conta quando quiser.",
        "Pode pedir informação sobre os seus dados ou opor-se a um tratamento. Se achar que os seus direitos não foram respeitados, pode queixar-se à Agência de Protecção de Dados (APD) de Angola."] },
      { title: "8. Contacto", paragraphs: [contactLine(email)] }
    ]
  };
}

export function deleteAccountPage(email?: string | null): InfoPage {
  return {
    slug: "apagar-conta", title: "Como apagar a minha conta", updated: LEGAL_UPDATED,
    intro: "Pode apagar a sua conta do Huambo Online a qualquer momento, no Site ou na APP.",
    sections: [
      { title: "Passos", paragraphs: [
        "1. Entre na sua conta (Site ou APP).",
        "2. Abra «A sua conta».",
        "3. No fim da página, em «Eliminar conta», escreva ELIMINAR e confirme."] },
      { title: "O que é apagado", paragraphs: [
        "A conta, o perfil, os anúncios, produtos, guardados, pesquisas guardadas, notificações e os dados ligados à conta.",
        "As avaliações que deixou a outras pessoas e as mensagens já enviadas podem ser apagadas ou ficar sem o seu nome."] },
      { title: "Não consegue entrar?", paragraphs: [
        "Use «Esqueci-me da palavra-passe» na página de entrada para recuperar o acesso e depois apague a conta.",
        contactLine(email)] }
    ]
  };
}

export function returnsPage(email?: string | null): InfoPage {
  return {
    slug: "devolucoes", title: "Devoluções e reembolsos", updated: LEGAL_UPDATED,
    intro: "Como pedir a devolução, o reembolso ou a troca de uma encomenda feita na Loja do Huambo Online, e o que acontece em cada passo.",
    sections: [
      { title: "Anúncios: o artigo tem de corresponder ao anúncio", paragraphs: [
        "Quem publica um anúncio declara que a descrição, as fotografias e o preço correspondem ao artigo, incluindo defeitos.",
        "Se comprou ou arrendou e o artigo tem um defeito escondido, é diferente da descrição, é outro artigo ou faltam peças, abra o anúncio e carregue em «O artigo não corresponde ao anúncio» (até 7 dias depois do negócio).",
        "Escolha o que quer: troca, devolução e reembolso, ou reembolso. O dono tem 3 dias para responder; se recusar ou não responder, peça à administração para decidir. As reclamações aparecem nesta página."] },
      { title: "1. Quando posso pedir", paragraphs: [
        "Numa encomenda da Loja que já pagou ou que já recebeu, até 14 dias depois da entrega.",
        "Motivos: não recebeu, chegou estragado ou partido, é diferente do anúncio, artigo errado (modelo, tamanho, cor) ou faltam artigos.",
        "Se a encomenda ainda está «Pendente», não precisa de pedido: carregue em «Cancelar»."] },
      { title: "2. O que posso pedir", paragraphs: [
        "Reembolso: o vendedor devolve-lhe o dinheiro (todo ou parte).",
        "Devolução e reembolso: devolve o artigo ao vendedor e ele devolve-lhe o dinheiro.",
        "Troca: o vendedor envia-lhe outro artigo igual, em bom estado."] },
      { title: "3. Como pedir", paragraphs: [
        "Abra «Encomendas», escolha a encomenda e carregue em «Pedir devolução ou reembolso».",
        "Escolha o motivo, explique o que aconteceu e junte até 4 fotografias. As fotografias ficam privadas: só o vendedor e a administração as veem.",
        "Acompanhe tudo em «Devoluções e reembolsos». Cada passo envia uma notificação à outra pessoa."] },
      { title: "4. O que o vendedor faz", paragraphs: [
        "Aceita o pedido ou recusa-o explicando o motivo.",
        "Se aceitar uma devolução, combinem pelas mensagens onde entregar o artigo. Quando o receber, confirma e devolve o dinheiro.",
        "Quando devolver o dinheiro, carrega em «Já devolvi o dinheiro» e o comprador confirma que recebeu."] },
      { title: "5. Se não se entenderem", paragraphs: [
        "Se o vendedor recusar, pode chamar a administração logo. Se alguém não responder em 3 dias, qualquer um dos dois pode chamar a administração.",
        "A administração vê o pedido, as mensagens e as fotografias, e decide: reembolso (todo ou parte), devolução, troca ou recusa. A decisão fica registada.",
        "Quem não cumprir uma decisão pode ter a conta suspensa."] },
      { title: "6. Encomenda paga e cancelada", paragraphs: [
        "Se a encomenda já estava paga e foi cancelada, o pedido de reembolso abre sozinho: o vendedor tem de devolver o dinheiro todo.",
        "Com pagamento protegido, quem devolve o dinheiro ainda guardado é o Huambo Online: indique no pedido o seu IBAN ou o número Multicaixa Express."] },
      { title: "7. Como chega o dinheiro", paragraphs: [
        "Nas compras pagas ao vendedor (na entrega, transferência ou Multicaixa Express), o Huambo Online não guarda o dinheiro: o reembolso é feito pelo vendedor, pelo mesmo meio do pagamento, salvo outro acordo entre os dois.",
        "Nas compras com pagamento protegido, o dinheiro fica guardado pelo Huambo Online até confirmar a receção. Enquanto estiver guardado, o reembolso é feito pelo Huambo Online. Depois de entregue ao vendedor, é o vendedor que devolve.",
        "Guarde os comprovativos de pagamento e de reembolso: podem ser pedidos pela administração."] },
      { title: "8. Negócios fora da Loja", paragraphs: [
        "Nos anúncios classificados (venda, troca, arrendamento) o negócio é feito diretamente entre as pessoas, mas vale a garantia de conformidade: se o artigo não corresponder ao anúncio, use «O artigo não corresponde ao anúncio» na página do anúncio (veja acima). Para outros problemas, use «Denunciar» e a administração analisa."] },
      { title: "9. Contacto", paragraphs: [contactLine(email)] }
    ]
  };
}

export type FaqItem = { q: string; a: string };
export const HELP_FAQ: FaqItem[] = [
  { q: "Como publico um anúncio?", a: "Carregue em «Vender» ou «Publicar anúncio», escolha o tipo e a finalidade, diga como quer vender (preço fixo, negociável, propostas, leilão ou troca), junte fotografias e publique." },
  { q: "O que é «Preço fixo», «Negociável» e «Aberto a propostas»?", a: "Preço fixo: quem quiser compra pelo preço indicado («Quero comprar»). Negociável: o comprador pode fazer uma proposta mais baixa. Aberto a propostas: o preço é só uma referência e os compradores dizem quanto pagam." },
  { q: "Como funcionam as trocas?", a: "Escolha «Só troca» ou marque «Também aceito troca» e diga o que aceita. Quem estiver interessado propõe um artigo (e pode juntar dinheiro). Veja todas em «Trocas»." },
  { q: "Como faço uma proposta?", a: "No anúncio, carregue em «Fazer proposta», indique o valor e/ou o que oferece em troca. O vendedor aceita ou recusa e recebe uma notificação; acompanhe em «As minhas propostas»." },
  { q: "Como retiro uma proposta?", a: "Em «As minhas propostas», carregue em «Retirar proposta». Só é possível enquanto o vendedor ainda não respondeu; depois de aceite, combine com ele pelas mensagens." },
  { q: "Como funcionam os leilões?", a: "Como no eBay: escreva o MÁXIMO que está disposto a pagar. O Huambo Online licita por si só o necessário para ficar à frente, até esse máximo, que ninguém vê. Se outra pessoa oferecer mais do que o seu máximo, recebe um aviso e pode subir. Em caso de empate ganha quem licitou primeiro. Quem ganha paga o preço final, que muitas vezes é menor do que o seu máximo. Alguns leilões têm «Comprar já»: pode comprar logo por esse preço, até alguém licitar. Acompanhe tudo em «As minhas licitações»; recebe um aviso quando faltar menos de 1 hora." },
  { q: "Como cancelo um lance num leilão?", a: "No anúncio do leilão, abra «Ver lances» e carregue em «Retirar o meu lance», escolhendo o motivo. Pode fazê-lo se faltarem mais de 12 horas para o fim, ou se o lance foi feito há menos de 1 hora. No máximo 3 vezes em 30 dias. O vendedor também pode cancelar os lances de uma pessoa, explicando porquê." },
  { q: "O que é o número do anúncio (ex.: A-1001)?", a: "Cada anúncio (A-…), produto (P-…) e encomenda (E-…) tem um número curto, que aparece na página. Use-o para falar com o vendedor ou com a administração, ou escreva-o na pesquisa para abrir o artigo diretamente." },
  { q: "Como mostro os meus trabalhos (portfólio)?", a: "Profissionais: em «A sua conta» → «Perfil profissional» → «Portfólio», carregue em «Juntar trabalho», dê um título e junte até 8 fotografias. Empresas: em «As minhas empresas» → «Logótipo e portfólio». Os trabalhos aparecem na sua página pública, em «Trabalhos realizados», e pode mudar a ordem." },
  { q: "Quanto custa ter perfil de profissional ou de empresa?", a: "O primeiro mês é grátis. Depois, os profissionais pagam 2 000 Kz por mês e as empresas 5 000 Kz por mês. Pague em «A sua conta» → «O meu plano», com a referência ou o comprovativo da transferência ou do Multicaixa Express. Recebe avisos 7 dias e 1 dia antes do fim. Sem pagamento, o perfil deixa de aparecer aos clientes até pagar." },
  { q: "Quanto custa vender na Loja e nos anúncios?", a: "Loja: o primeiro mês é grátis, depois 5 000 Kz por mês (se os produtos forem de uma empresa, basta a mensalidade da empresa). Anúncios: publicar é grátis; quando vende, arrenda ou aluga, paga uma comissão de 5% do valor em 7 dias, em «A sua conta» → «Comissões». Ao marcar «Vendido» ou «Arrendado» indica o valor e vê logo a comissão; num pedido de aluguer, a comissão é sobre o valor total aceite." },
  { q: "Como ponho o meu anúncio em destaque?", a: "Em «Os meus anúncios», no anúncio publicado, carregue em «⭐ Destacar». Pague o valor indicado (500 Kz por 7 dias) por transferência ou Multicaixa Express e escreva a referência ou junte o comprovativo. Quando a administração confirmar, o anúncio aparece no topo das listas com o selo «⭐ Destaque». Pode prolongar antes de terminar." },
  { q: "Como sigo um profissional, uma empresa ou uma loja?", a: "Na página do profissional, da empresa ou do vendedor, carregue em «➕ Seguir». Recebe um aviso quando publicar um anúncio, um produto ou um trabalho novo (no máximo um aviso por hora de cada um). Veja quem segue em «A sua conta» → «A seguir»; para deixar de seguir, carregue em «✔ A seguir»." },
  { q: "Como vendo produtos do campo (milho, batata, gado…)?", a: "Em «Vender», escolha o tipo «Artigo» ou «Outro» e ligue «🌾 Produto do campo». Diga o tipo (cereais, tubérculos, gado…), a unidade de venda (kg, saco de 50 kg, tonelada, cabeça…), a quantidade e, se ainda não colheu, a data «disponível a partir de». O preço aparece por unidade (ex.: 12 000 Kz / saco 50 kg) e o anúncio entra na secção «🌾 Agricultura e campo»." },
  { q: "Como peço um serviço a um profissional?", a: "Abra a página do profissional ou empresa e use «Pedir serviço». Quando o serviço terminar, confirme e avalie — a avaliação fica marcada «Serviço confirmado»." },
  { q: "Como avalio um vendedor ou comprador?", a: "Depois de uma encomenda concluída, ou quando o anúncio é marcado como vendido com a pessoa certa, aparece em «Avaliações» para avaliar." },
  { q: "Como fico com o selo «Verificado»?", a: "Em «A sua conta», abra «Verificar perfil» e envie a fotografia do BI (ou do alvará/NIF da empresa). O documento fica privado; a administração responde por notificação." },
  { q: "O que é o «Pagamento protegido»?", a: "Nas compras da Loja, pode pagar ao Huambo Online em vez de pagar ao vendedor. Guardamos o dinheiro e o vendedor só o recebe depois de confirmar que recebeu a encomenda. Se houver problema, peça reembolso em «Encomendas»: o dinheiro fica congelado até se resolver. Se não confirmar nem reclamar uns dias depois da entrega, o pagamento vai para o vendedor." },
  { q: "Vendo na Loja: como recebo o dinheiro do pagamento protegido?", a: "Espere pelo aviso «Pagamento recebido» antes de enviar. Depois de entregar, marque a encomenda como «Entregue». Quando o cliente confirmar (ou passar o prazo sem reclamação), o dinheiro passa para «A sua conta» → «O meu saldo». Indique o seu IBAN ou número Multicaixa Express e carregue em «Pedir levantamento»." },
  { q: "Como partilho um anúncio no WhatsApp?", a: "Abra o anúncio ou o produto e carregue em «📲 Partilhar no WhatsApp». A mensagem leva o título, o preço, o número do anúncio (ex.: A-1023) e a ligação, e no WhatsApp aparece a fotografia. Escolha o contacto ou o grupo." },
  { q: "Os compradores podem ver o meu WhatsApp?", a: "Para proteger a sua privacidade, o seu número não é mostrado aos compradores: falam consigo pelas Mensagens do Huambo Online. Se guardar o seu WhatsApp em «A sua conta» → «WhatsApp», só a equipa do Huambo Online o vê." },
  { q: "Como funciona o «Convide um amigo»?", a: "Em «Conta» → «Convidar amigos» tem o seu código e a sua ligação. Quem criar conta com o seu convite (nos primeiros 14 dias) fica ligado a si. Quando essa pessoa pagar a primeira mensalidade (profissional, empresa ou loja), ganha 1 mês grátis na sua mensalidade. Se ainda não tiver mensalidade, o prémio fica guardado." },
  { q: "O que é um agente no terreno?", a: "É uma pessoa da praça (por exemplo, do Kapango) que ajuda os vendedores a pôr anúncios no Huambo Online. O anúncio fica sempre na conta do vendedor; ao publicar, o vendedor escreve o código do agente (ex.: AG1001). Quando esse anúncio é vendido, o agente ganha uma percentagem do valor da venda, que a administração confirma e que entra no saldo do agente. Para ser agente, abra «Conta» → «Ser agente»." },
  { q: "E se o artigo não corresponder ao anúncio?", a: "Todos os anúncios têm garantia de conformidade: quem publica declara que a descrição é verdadeira e completa, incluindo defeitos. Se o artigo que comprou ou arrendou tiver um defeito escondido ou for diferente, abra o anúncio e carregue em «O artigo não corresponde ao anúncio» (até 7 dias depois do negócio). Pode pedir troca, devolução e reembolso, ou reembolso. Se o dono recusar ou não responder em 3 dias, a administração decide. Nas compras da Loja, use «Devoluções e reembolsos» na encomenda." },
  { q: "Como evito burlas?", a: "Encontre-se num lugar público e movimentado (veja «Pontos de encontro seguros» em «Segurança»), veja o artigo e pague na entrega, ou use o Pagamento protegido na Loja. Nunca pague adiantado nem dê códigos que recebe por SMS ou o PIN. Nas mensagens, o Huambo Online avisa quando alguém pede pagamento adiantado ou códigos. Se suspeitar, use «Bloquear» e «Denunciar»." },
  { q: "Como peço uma devolução ou reembolso?", a: "Em «Encomendas», escolha a encomenda e carregue em «Pedir devolução ou reembolso» (até 14 dias depois da entrega). Explique o problema e junte fotografias. Se o vendedor recusar ou não responder, pode chamar a administração. Veja «Devoluções e reembolsos»." },
  { q: "Como gasto menos dados (saldo)?", a: "Ligue «📉 Poupar dados» no topo do Site, na página inicial da APP ou em «A sua conta». As fotografias das listas deixam de carregar (aparece um ícone) e, nos anúncios, só carregam quando tocar em «Ver as fotografias». Os vídeos só carregam quando carregar em ▶. No Site, «Automático» liga sozinho quando o telemóvel está em poupança de dados." },
  { q: "Posso usar sem internet?", a: "Pode ver a página inicial, a última pesquisa e os últimos anúncios que abriu. Para publicar, enviar mensagens ou propostas precisa de ligação." },
  { q: "Como apago a minha conta?", a: "Em «A sua conta», no fim da página, escreva ELIMINAR e confirme. Veja os pormenores em «Como apagar a minha conta»." }
];

/** Ligações para o rodapé do Site e para a Conta na APP. */
export const INFO_LINKS: { href: string; label: string }[] = [
  { href: "/ajuda", label: "Ajuda" }, { href: "/seguranca", label: "Segurança e burlas" }, { href: "/termos", label: "Termos de Uso" },
  { href: "/privacidade", label: "Política de Privacidade" }, { href: "/devolucoes", label: "Devoluções e reembolsos" }, { href: "/apagar-conta", label: "Como apagar a conta" }
];
