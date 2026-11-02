# Maré 🌊

Casca do app **Maré**, um organizador calmo para o dia a dia, instalável no celular (PWA) e com notificações próprias.

Aqui ficam só os arquivos públicos do app: ícones, manifesto, o *service worker* e o carregador.
A rotina, as tarefas e as anotações **não ficam neste repositório**: elas moram no Google Drive da dona do app e chegam por um servidor no Google Apps Script, protegido por uma chave que só existe no celular dela.

- `index.html` e `shell.js`: abrem o app e conversam com o servidor.
- `sw.js`: deixa o app abrir sem internet e mostra as notificações.
- `manifest.webmanifest` e os ícones: nome, cores e ícone do app instalado.
