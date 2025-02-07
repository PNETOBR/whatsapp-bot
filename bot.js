// Importação de módulos
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');

const client = new Client();
const delay = ms => new Promise(res => setTimeout(res, ms)); // Função de delay

let chamados = {}; // Armazena números de chamados
let activeListeners = new Map(); // Evita duplicação de listeners
let atendimentoSuspenso = new Set(); // Armazena usuários que falarão com atendente humano

// Serviço de leitura do QR Code
client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => console.log('✅ WhatsApp conectado!'));
console.clear();

client.initialize();

// Função para enviar mensagem com delay
async function sendMessageWithDelay(remetente, msg, typingDelay = 1000, messageDelay = 1500) {
    const chat = await client.getChatById(remetente);
    await chat.sendStateTyping();
    await delay(typingDelay);
    await client.sendMessage(remetente, msg);
    await delay(messageDelay);
}

// Função para exibir o menu principal
async function showMainMenu(remetente) {
    await sendMessageWithDelay(
        remetente,
        `Agora que temos seu número de chamado, por favor, escolha uma das opções abaixo:\n\n1️⃣ - Priorizar Chamado \n2️⃣ - Relatar um problema \n3️⃣- Falar com um atendente \n4️⃣- Falar com Financeiro\n5️⃣- Falar com Comercial\n6️⃣- Encerrar Conversa!`
    );
}

// Evento de mensagem recebida
client.on('message', async msg => {
    if (msg.isGroup) return; // Ignora mensagens de grupos

    const remetente = msg.from;

    // Se o atendimento está suspenso, apenas reativa quando o cliente quiser voltar ao menu
    if (atendimentoSuspenso.has(remetente)) {
        if (/^(menu|voltar|\d{5})$/i.test(msg.body)) {
            atendimentoSuspenso.delete(remetente); // Retorna o bot para atendimento normal
            await sendMessageWithDelay(remetente, `Atendimento automatizado retomado. Vamos continuar! 😊`);
            await showMainMenu(remetente);
        }
        return; // Ignora qualquer outra mensagem enquanto o atendimento está suspenso
    }

    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const name = contact.pushname ? contact.pushname.split(" ")[0] : "usuário";

    // Se for a primeira mensagem do usuário
    if (!chamados[remetente] && /^(iniciar|boa noite|boa dia|boa tarde|Olá|olá|oboai||ola|oii|dia|tarde|noite|bom|hello|oie|eai|prezados|prezado|opa|caros|paulo|suporte|tecnologia|bot|OI|Oi|oI|Olá|OLÁ|OLA|)$/i.test(msg.body)) {
        await sendMessageWithDelay(remetente, `Olá, ${name}! 😊\nBem-vindo ao EnvisionBot! 🚀\n\nPor favor, informe o número do seu chamado (5 dígitos).`);
        await sendMessageWithDelay(remetente, `Caso não tenha um número de chamado, envie uma email para suporte@email.com.br ou acesso o link abaixo\n https://link.com/login`);
        return;
    }

    // Se o usuário ainda não enviou o número do chamado
    if (!chamados[remetente]) {
        const numeroChamado = msg.body.trim();

        if (/^\d{5}$/.test(numeroChamado)) {
            chamados[remetente] = { numero: numeroChamado, nome: name, problema: "" };
            console.log(`Número do chamado salvo para ${name}: ${numeroChamado}`);
            await showMainMenu(remetente);
        } else {
            await sendMessageWithDelay(remetente, `${name}, para iniciarmos o atendimento digite "iniciar".`);
        }
        return;
    }

    // Se o usuário quiser voltar ao menu principal
    if (msg.body === '0' || /^(menu|voltar)$/i.test(msg.body)) {
        await sendMessageWithDelay(remetente, `Voltando ao menu principal...`);
        await showMainMenu(remetente);
        return;
    }

    // Switch case para opções do menu
    switch (msg.body) {
        case '1':
            await handlePrioritizeChamado(remetente);
            break;
        case '2':
            await handleProblema(remetente);
            break;
        case '3':
            await sendMessageWithDelay(remetente, 'Aguarde até que um de nossos atendentes esteja disponível para te ajudar.\n\nOu digite "voltar" para acessar o menu novamente.');
            atendimentoSuspenso.add(remetente); // Marca o atendimento como suspenso
            console.log(`Cliente ${remetente} selecionou a opção 3 - Falar com um atendente.`);
            break;
        case '4':
            await sendMessageWithDelay(remetente, 'Clique no link abaixo para falar com o financeiro.\n\nhttps://wa.me/5511900000000\n\nOu digite 0️⃣ para voltar ao menu.');
            break;
        case '5':
            await sendMessageWithDelay(remetente, 'Clique no link abaixo para falar com o comercial.\n\nhttps://wa.me/5511900000000\n\nOu digite 0️⃣ para voltar ao menu.');
            break;
        case '6':
            await sendMessageWithDelay(remetente, 'Espero ter ajudado! Caso tenha mais alguma dúvida, estarei por aqui.');
            await sendMessageWithDelay(remetente, 'Até mais!');
            delete chamados[remetente]; // Limpa os dados do chamado
            break;
        default:
            //await sendMessageWithDelay(remetente, 'Opção inválida! Por favor, escolha uma das opções do menu.');
            break;
    }
});

// Funções específicas para as opções do menu
async function handlePrioritizeChamado(remetente) {
    await sendMessageWithDelay(remetente, 'Seu chamado está sendo enviado para equipe analisar.');
    await sendMessageWithDelay(remetente, 'Seu chamado foi priorizado com sucesso!');
    await sendMessageWithDelay(remetente, 'Digite 0️⃣ para voltar ao menu ou 6️⃣ para encerrar a conversa.');
}

// Função para relatar problema no atendimento
async function handleProblema(remetente) {
    if (activeListeners.has(remetente)) return;

    await sendMessageWithDelay(remetente, 'Descreva o seu problema para que possamos te ajudar.\n\nOu digite 0️⃣ para voltar ao menu.');

    const problemListener = async newMsg => {
        if (newMsg.from === remetente) {
            if (newMsg.body === '0' || /^(menu|voltar)$/i.test(newMsg.body)) {
                client.removeListener('message', problemListener);
                activeListeners.delete(remetente);
                await sendMessageWithDelay(remetente, `Voltando ao menu principal...`);
                await showMainMenu(remetente);
                return;
            }

            chamados[remetente].problema = newMsg.body;
            console.log(`Problema registrado para ${chamados[remetente].nome}: ${newMsg.body}`);

            await sendMessageWithDelay(remetente, 'Obrigado por relatar o problema! Nossa equipe analisará a sua solicitação.');

            client.removeListener('message', problemListener);
            activeListeners.delete(remetente);
        }
    };

    client.on('message', problemListener);
    activeListeners.set(remetente, problemListener);
}