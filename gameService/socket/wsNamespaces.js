const { socketIOServer } = require('./webSocket')
const Match = require('../model/match/match')

exports.createMatchNamespace = async () => {

    const match = await Match.buildMatch();
    const wordLockTime = 10000


    
    const nsp = Date.now();
    const socketNamespace = socketIOServer.of(nsp)

    socketNamespace.on('connection', (socket) => {
      console.log('user connected' + socket.id)  
      //socket.on('', () => {})

      socket.on('disconnect', () => {
        console.log('user disconnected' + socket.id)
        match.disconnectPlayerByConnection(socket.id) 
        socketNamespace.emit('players', match.getPlayers())
        
        if(match.getConnectedPlayers().length <= 0){    //delete match if all players disconnected
          const connectedNameSpaceSockets = Object.keys(socketNamespace.connected);
          connectedNameSpaceSockets.forEach(socketId => {
              socketNamespace.connected[socketId].disconnect();
          });
          socketNamespace.removeAllListeners(); 
          delete socketIOServer.nsps[nsp]
          console.log('match deleted due to lack of connections')
        }        
      })      

      socket.on('connectPlayer', (playerId) => {  
        const player = {
          id: playerId,
          socketId: socket.id
        }
        const connect = match.connectPlayer(player)
        if(connect){          
          socketNamespace.emit('players', match.getPlayers())
          socket.emit('dataMatrix', match.getMatchMatrix())
          socket.emit('clues', match.getClues())
          socket.emit('lockedWords', match.getLockedWords())
          socket.emit('solvedWords', match.getSolvedWords())
          //socket.emit('players', match.getPlayers())
          socket.emit('player', match.getPlayer(playerId))
        }else{
          socket.emit('errorMessage', `Cannot connect player ${player.id}`)          
        }
      })

      /*socket.on('disconnectPlayer', (playerId) => {
        const player = {
          id: playerId
        }
        const disconnect = match.disconnectPlayer(player)
        if(disconnect){
          socketNamespace.emit('players', match.getPlayers())
        }else{
          socket.emit('errorMessage', `Cannot disconnect player ${player.id}`)
        }
      })*/

      socket.on('getPlayer', (playerId) => {
        const player = match.getPlayer(playerId)
        if(player){
          socket.emit('player', player)
        }else{
          socket.emit('errorMessage', `Cannot find player ${playerId}`)
        }
      })

      socket.on('lockWord', (word) => {
        const lock = match.lockWord(word)
        if(lock){
          socketNamespace.emit('lockedWords', match.getLockedWords())
          setTimeout(() => { 
            const unlock = match.unlockWord(word)
            if(unlock){
              socketNamespace.emit('lockedWords', match.getLockedWords())
            }else{
              socket.emit('errorMessage', `Cannot unlock word ${word.number} ${word.profile}`)
            }
          }, wordLockTime);
        }else{
          socket.emit('errorMessage', `Cannot lock word ${word.number} ${word.profile}`)
        }
      })

      socket.on('updateMatrix', (update) => {
        const updateMatch = match.updateMatchMatrix(update)

        socketNamespace.emit('dataMatrix', match.getMatchMatrix())    //a cada alteração, os dados são repassados a todos os jogadores

        if(updateMatch){      //caso tenha terminado de inserir as letras
          //desbloqueia a palavra(necessário pois a palavra pode não ter sido resolvida)
          const word = update.word
          const unlock = match.unlockWord(word)
          if(unlock){
            socketNamespace.emit('lockedWords', match.getLockedWords())
          }else{
            socket.emit('errorMessage', `Cannot unlock word ${word.number} ${word.profile}`)
          }
          //atualiza a lista de palavras resolvidas e score de players(para caso ter sido resolvido)
          socketNamespace.emit('solvedWords', match.getSolvedWords())
          socketNamespace.emit('players', match.getPlayers())
        }else{              
          //enquanto todas as letras não tiverem sido inseridas
        }        
      })

      
    })

    return nsp
}