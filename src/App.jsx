
import { useState, useRef } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'; 
import { Chess } from 'chess.js';
import './App.css';

const symbols = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

function App() {
  const gameRef = useRef(new Chess());
  const videoRef=useRef(null);
  const handLandmarkerRef=useRef(null);
  const boardRef=useRef(null);
  const [handStatus, setHandStatus]=useState('Hand tracking not started');
  const [cursorPosition, setCursorPosition] = useState(null);
  const [cameraStatus, setCameraStatus]=useState('Camera not Started');
  const[isPinching,setIsPinching]=useState(false);
  const wasPinchingRef=useRef(false);
  const game = gameRef.current;

  const [board, setBoard] = useState(game.board());
  const [selected, setSelected] = useState(null);
  const selectedRef=useRef(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [capturedGods, setCapturedGods] = useState([]);
  const [capturedMonsters, setCapturedMonsters] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [message, setMessage] = useState("Gods' turn to play!");
  const canvasRef=useRef(null);
  const animationRef=useRef(null);
  const handDetectedRef=useRef(false);

  function restartGame() {
  game.reset();
  setBoard(game.board());
  setSelected(null);
  setLegalMoves([]);
  setMessage("Gods' turn to play!");
  setCapturedGods([]);
  setCapturedMonsters([]);
  setMoveHistory([]);
}

function detectHands() {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  const detector = handLandmarkerRef.current;

  if (!video || !canvas || !detector || video.readyState < 2) {
    animationRef.current = requestAnimationFrame(detectHands);
    return;
  }

  const ctx = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const results = detector.detectForVideo(video, performance.now());

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = results.landmarks?.[0];

  if (landmarks) {
    ctx.fillStyle = '#facc15';
    
    landmarks.forEach(point => {
      ctx.beginPath();
      ctx.arc(
        point.x * canvas.width,
        point.y * canvas.height,
        6,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });
    const indexTip = landmarks[8];
    const thumbTip= landmarks[4];
    const pinchDistance=Math.hypot(
      indexTip.x-thumbTip.x,
      indexTip.y-thumbTip.y
    );
    const pinching=pinchDistance<0.05;
    const pinchStarted=pinching && !wasPinchingRef.current;
    setIsPinching(pinching);
    wasPinchingRef.current=pinching;
    setCursorPosition({
      x:indexTip.x*100,
      y:indexTip.y*100,
    });
    const board=boardRef.current;
    if(board){
      const rect=board.getBoundingClientRect();
      const x=(indexTip.x*video.videoWidth);
      const y=(indexTip.y*video.videoHeight);
      const boardX = indexTip.x * rect.width;
      const boardY = indexTip.y * rect.height;

      const squareX = Math.floor(boardX / (rect.width / 8));
      const squareY = Math.floor(boardY / (rect.height / 8));
      if(
        squareX>=0 && squareX<8 &&
        squareY>=0 && squareY <8
      ){
        const files='abcdefgh';
        const square=files[squareX]+(8-squareY);
        console.log('Square:', square, '| Pinch:', pinching, '| Selected:', selectedRef.current);
        if(pinchStarted){
          handleSquareClick(squareY,squareX);
        }
      }
      
    }
    ctx.beginPath();
    ctx.arc(
      indexTip.x*canvas.width,
      indexTip.y*canvas.height,
      12,
      0,
      2*Math.PI
    );
    ctx.fillStyle='#ff4d6d';
    ctx.fill();
    ctx.strokeStyle='#ffffff';
    ctx.lineWidth=2;
    ctx.stroke();

    if (!handDetectedRef.current) {
      setHandStatus('Hand detected! ✋');
      handDetectedRef.current = true;
    }
  } else if (handDetectedRef.current) {
    setHandStatus('Show your hand to the camera');
    handDetectedRef.current = false;
    setCursorPosition(null);
  }

  animationRef.current = requestAnimationFrame(detectHands);
}
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    setCameraStatus('Camera connected!');

  } catch (error) {
    console.error('Camera error:', error);
    setCameraStatus('Camera error: ' + error.message);
    return;
  }

  try {
    setHandStatus('Loading hand detector...');

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    handLandmarkerRef.current = await HandLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      }
    );

    setHandStatus('Hand detector ready!');
    handDetectedRef.current=false;
    detectHands();

  } catch (error) {
    console.error('MediaPipe error:', error);
    setHandStatus('Detector error: ' + error.message);
  }
}

  
function handleSquareClick(row, col) {
  const files = 'abcdefgh';
  const square = files[col] + (8 - row);
  const piece = game.get(square);

  const currentSelected = selectedRef.current;

  // Select a piece
  if (currentSelected === null) {
    if (piece && piece.color === game.turn()) {
      setSelected(square);
      selectedRef.current = square;
      setLegalMoves(
        game.moves({ square, verbose: true }).map(move => move.to)
      );
    }
    return;
  }

  // Select a different piece belonging to the current player
  if (piece && piece.color === game.turn()) {
    setSelected(square);
    selectedRef.current = square;
    setLegalMoves(
      game.moves({ square, verbose: true }).map(move => move.to)
    );
    return;
  }

  try {
    const move = game.move({
      from: currentSelected,
      to: square,
      promotion: 'q',
    });

    if (move) {
      setMoveHistory(game.history());

      if (move.captured) {
        const capturedPiece =
          (move.color === 'w' ? 'b' : 'w') + move.captured;

        if (move.color === 'w') {
          setCapturedMonsters(prev => [...prev, capturedPiece]);
        } else {
          setCapturedGods(prev => [...prev, capturedPiece]);
        }
      }

      setBoard(game.board());

      if (game.isCheckmate()) {
        setMessage('CHECKMATE! The battle is over!');
      } else if (game.isDraw()) {
        setMessage('The battle ends in a draw!');
      } else if (game.isCheck()) {
        setMessage('CHECK! Protect your King!');
      } else {
        setMessage(
          game.turn() === 'w'
            ? "Gods' turn to play!"
            : "Monsters' turn to play!"
        );
      }
    }
  } catch {
    setMessage('Illegal move! Try another square.');
  }

  setSelected(null);
  selectedRef.current = null;
  setLegalMoves([]);
}


  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>⚔ GODS <span>VS</span> MONSTERS</h1>
          <p>Play. Gesture. Conquer.</p>
        </div>
        <div className="status">
          ● {game.turn() === 'w' ? 'GODS TURN ⚡' : 'MONSTERS TURN 👹'}
        </div>  
      </header>

      <main className="game-layout">
        <section className="game-panel">
          <h2>⚡ The Battle Begins</h2>
          <div className="turn-indicator">
          {game.turn() === 'w' ? '⚡ GODS ARE PLAYING' : '👹 MONSTERS ARE PLAYING'}
          </div>
          <div className="team-label">👹 MONSTERS</div>

          <div className="chessboard" ref={boardRef}>
            {board.map((row, r) =>
              row.map((piece, c) => {
                const square = 'abcdefgh'[c] + (8 - r);
                const pieceKey = piece
                  ? piece.color + piece.type
                  : '';

                return (
                  <div
                    key={square}
                    onClick={() => handleSquareClick(r, c)}
                    className={`square ${(r + c) % 2 === 0 ? 'light' : 'dark'} ${
                      selected === square ? 'selected' : ''
                    } ${legalMoves.includes(square) ? 'legal-move' : ''}`}
                  >
                    {piece && (
                      <span className={
                        piece.color === 'w'
                          ? 'god-piece'
                          : 'monster-piece'
                      }>
                        {symbols[pieceKey]}
                      </span>
                    )}
                    {cursorPosition && (
                      <div
                        className="hand-cursor"
                        style={{
                          left:`${cursorPosition.x}%`,
                          top:`${cursorPosition.y}%`,
                        }}
                      />    
                    )}
                  </div>
                );
              })
            )}
            {cursorPosition && (
              <div
                className="hand-cursor"
                style={{
                  left: `${cursorPosition.x}%`,
                  top:`${cursorPosition.y}%`,
                }}
              />  
            )}
          </div>

          <div className="team-label">⚡ GODS</div>
          <div className="captured-section">

            <h3>👹 Fallen Monsters</h3>
             <div className="captured-pieces">

               {capturedMonsters.map((piece, index) => (<span key ={index}>{symbols[piece]}</span>))}
             </div>
             <h3>⚡ Fallen Gods</h3>
             <div className="captured-pieces">
              {capturedGods.map((piece,index)=>(<span key={index}>{symbols[piece]}</span>))}
             </div>

          </div>
          <button className="restart-btn" onClick={restartGame}>
            ↻ Restart Battle
          </button>
          <p>{message}</p>
        </section>

        <aside className="side-panel">
          <h2>✦ How to Play</h2>
          <div className="instruction">👆 Select your character</div>
          <div className="instruction">♟ Choose a destination</div>
          <div className="instruction">⚔ Follow chess rules</div>
          <div className="instruction">👑 Capture the enemy King</div>

          <div className="camera-box">
            <h3>📷 Gesture Control</h3>
          <div className="hand-camera-view">
            <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width="100%"
            />
            <canvas ref={canvasRef}/>
          </div>  
            
             <p>{cameraStatus}</p>
             <p>{handStatus}</p>
             <button onClick={startCamera} className="restart-btn">
              Start Camera
              </button>
          </div>
          <div className="history-panel">
            <h3>📜 Battle History</h3>
            {moveHistory.length===0 ? (<p>No Moves yet..</p>):(<div ClassName="history-list">{Array.from({length: Math.ceil(moveHistory.length/2)},(_,i)=>(
              <div className="history-row" key={i}>
                <span>{i+1}.</span>
                <span>{moveHistory[i*2]}</span>
                <span>{moveHistory[i*2+1]||'...'}</span>
              </div>  
            )
            )}
          </div>
        )}
      </div>  


          <div className="game-status">
            <h3>⚔ Game Status</h3>
            <p>{message}</p>
            <p>
              Turn: {game.turn() === 'w' ? 'Gods ⚡' : 'Monsters 👹'}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
