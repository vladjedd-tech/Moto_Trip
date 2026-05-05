import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Bell, Fuel, MapPin, CloudRain, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface NotificationSettingsProps {
  onBack: () => void;
}

export default function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "default"
  );
  const [swStatus, setSwStatus] = useState<string>("Verificando...");

  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setSwStatus("Ativo e Pronto"));
    } else {
      setSwStatus("Não suportado");
    }
  }, []);
  
  const requestPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      setToast(permission === 'granted' ? "Notificações Autorizadas!" : "Permissão Negada");
      setTimeout(() => setToast(null), 3000);
    }
  };

  const testNotification = async (type: string, message: string) => {
    setToast(`Enviando: ${type}`);
    setTimeout(() => setToast(null), 3000);

    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(type, {
              body: message,
              icon: "/vite.svg",
              badge: "/vite.svg",
              tag: 'moto-trip-test',
              actions: [
                { action: 'open', title: 'Abrir App' }
              ],
              requireInteraction: true,
              vibrate: [200, 100, 200]
            } as any);
          }
        } catch (e) {
          console.error("Erro ao disparar notificação:", e);
        }
      } else {
        requestPermission();
      }
    }
  };

  const notificationTypes = [
    { id: 'fuel', name: 'Posto de Combustível', icon: Fuel, color: 'bg-orange-100 text-orange-600', msg: 'Próxima parada em 2km: Shell - Joinville' },
    { id: 'toll', name: 'Pedágio Próximo', icon: ShieldCheck, color: 'bg-blue-100 text-blue-600', msg: 'Atenção: Pedágio a 15km. Valor moto: R$ 6,50' },
    { id: 'weather', name: 'Alerta de Clima', icon: CloudRain, color: 'bg-indigo-100 text-indigo-600', msg: 'Mudança no tempo: Chuva leve prevista para os próximos 30km' },
    { id: 'arrival', name: 'Chegada ao Destino', icon: MapPin, color: 'bg-green-100 text-green-600', msg: 'Você chegou ao seu destino em Pato Branco - PR' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-6 max-w-md mx-auto h-full bg-white"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-800 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 whitespace-nowrap"
          >
            <CheckCircle2 className="text-green-500 w-5 h-5" />
            <span className="font-bold text-sm">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Teste de Notificações</h2>
          <div className="grid gap-3">
            {notificationTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => testNotification(type.name, type.msg)}
                className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
              >
                <div className={`p-3 rounded-xl ${type.color}`}>
                  <type.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{type.name}</p>
                  <p className="text-xs text-gray-500">Testar envio manual</p>
                </div>
                <Bell className="w-4 h-4 text-gray-300" />
              </button>
            ))}
          </div>
        </section>

        <section className="p-4 bg-gray-50 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Permissão do Sistema</h3>
            <div className="flex gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                permissionStatus === 'granted' ? 'bg-green-100 text-green-600' : 
                permissionStatus === 'denied' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'
              }`}>
                {permissionStatus === 'granted' ? 'Ativo' : permissionStatus === 'denied' ? 'Bloqueado' : 'Pendente'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-50 text-blue-600 border border-blue-100">
                SW: {swStatus}
              </span>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              {permissionStatus === 'denied' 
                ? "A permissão foi negada. Você precisa clicar no ícone de 'cadeado' na barra de endereços do seu navegador e permitir as Notificações manualmente."
                : "Para receber avisos externos na barra do Android com o app em segundo plano, a permissão deve ser concedida."
              }
            </p>

            {window.self !== window.top && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                  ⚠️ NOTA: Você está no modo preview. Navegadores bloqueiam notificações em iframes. 
                  Para testar, abra o app em uma <b>nova aba</b>.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <button 
                onClick={requestPermission}
                className="w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
              >
                {permissionStatus === 'granted' ? 'Permissão já concedida' : 'Autorizar Notificações'}
              </button>
              
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
              >
                Abrir em Nova Aba (Full)
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
