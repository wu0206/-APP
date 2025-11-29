import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { 
  MapPin, Clock, Navigation, Plus, 
  Calendar, ArrowRight, Car, Trash2, X,
  Footprints, Train, Edit2, ExternalLink, Share2, LogIn, User, Coffee
} from 'lucide-react';

const appId = 'travel-planner-v1'; 
const APP_VERSION = 'v1.3'; 

// --- Helper Functions ---
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTime = (date) => date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

const formatTabDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d); 
    const dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    return `${m}/${d} ${dayMap[dateObj.getDay()]}`;
};

// --- Sub-Components (Cozy Style) ---

const TransportItem = ({ stop, onEdit }) => {
  const getCurrentLocNavUrl = () => {
    if (!stop) return '#';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.name)}&travelmode=${stop.transportMode || 'driving'}`;
  };

  const handleEdit = (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    onEdit(stop);
  };

  return (
    <div className="ml-8 mb-4 relative group">
      <div className="absolute left-[-19px] top-[-10px] bottom-[-10px] w-0 border-l-2 border-dashed border-[#dcd7c9] z-0"></div>
      
      <div className="flex items-center gap-2">
          <a 
            href={getCurrentLocNavUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-between p-3 rounded-xl border border-[#e6e2d3] bg-[#fdfbf7] text-[#6b615b] cursor-pointer hover:bg-[#f4f1ea] transition-colors shadow-sm no-underline"
          >
            <div className="flex items-center gap-2">
              {stop.transportMode === 'walking' ? <Footprints className="w-4 h-4 text-[#a3978b]" /> : 
               stop.transportMode === 'transit' ? <Train className="w-4 h-4 text-[#a3978b]" /> :
               <Car className="w-4 h-4 text-[#a3978b]" />}
              <span className="text-sm font-medium tracking-wide">
                {stop.transportMode === 'walking' ? '步行' : 
                 stop.transportMode === 'transit' ? '大眾運輸' : '開車'} 
                 ・約 {stop.travelMinutes || 30} 分
                 <span className="text-[10px] ml-1 opacity-60">(導航)</span>
              </span>
            </div>
            <Navigation className="w-4 h-4 text-[#8c9a8c]" />
          </a>

          <button 
            onClick={handleEdit}
            className="p-3 bg-[#fdfbf7] border border-[#e6e2d3] rounded-full text-[#a3978b] hover:text-[#8c9a8c] hover:border-[#8c9a8c] shadow-sm transition-all active:scale-95"
            title="編輯交通方式"
          >
            <Edit2 className="w-4 h-4" />
          </button>
      </div>
    </div>
  );
};

const LocationItem = ({ stop, onEdit }) => {
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(stop.name)}`;

  return (
    <div className="flex gap-3 relative z-10">
      <div className="flex flex-col items-center gap-1 w-10 pt-1 shrink-0">
        <div className={`w-3 h-3 rounded-full ring-4 ring-[#fdfbf7] shadow-sm ${stop.isFixedTime ? 'bg-[#d4a373]' : 'bg-[#a3b18a]'}`}></div>
        <span className="text-[10px] font-bold text-[#8d837a] mt-1 text-center leading-tight font-mono">
            {stop.calculatedArrival}
            <br/>
            <span className="text-[#beb3a9] font-normal">抵達</span>
        </span>
      </div>

      <div className={`flex-1 bg-white p-4 rounded-xl shadow-[2px_2px_0px_rgba(230,226,211,0.6)] border flex gap-3 group transition-colors ${stop.isFixedTime ? 'border-[#eaddcf]' : 'border-[#e6e2d3] hover:border-[#a3b18a]'}`}>
        <a 
            href={googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 cursor-pointer block no-underline"
        >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-[#4a4238] text-lg leading-tight flex items-center gap-2">
                  {stop.name}
                  {stop.isFixedTime && <span className="text-[10px] bg-[#fff5eb] text-[#c49261] px-2 py-0.5 rounded-full border border-[#faeadd] whitespace-nowrap">指定時間</span>}
                  <ExternalLink className="w-3 h-3 text-[#dcd7c9] opacity-50 group-hover:opacity-100 transition-opacity" />
              </h3>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-[#8d837a]">
              <div className="flex items-center gap-1 bg-[#f7f5f0] px-2 py-1 rounded text-[#6b615b]">
                <Clock className="w-3 h-3" />
                <span>停留 {Number(stop.stayDuration).toFixed(1).replace(/\.0$/, '')} 小時</span>
              </div>
              <div className="text-xs text-[#b5a89e]">
                 {stop.calculatedDeparture} 離開
              </div>
            </div>

            {stop.notes && (
                <div className="mt-3 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#e6e2d3] rounded-full"></div>
                    <p className="pl-3 text-xs text-[#6b615b] leading-relaxed">
                        {stop.notes}
                    </p>
                </div>
            )}
        </a>

        <div className="flex flex-col gap-2 border-l pl-3 border-[#f0ece3] justify-center">
             <button 
                onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    onEdit(stop); 
                }}
                className="p-3 hover:bg-[#f7f5f0] rounded-lg text-[#b5a89e] hover:text-[#8c9a8c] transition-colors"
                title="編輯地點"
             >
                <Edit2 className="w-5 h-5" />
             </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function TravelPlanner() {
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);

  const [editingStop, setEditingStop] = useState(null);
  const [editingTransport, setEditingTransport] = useState(null);

  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripDate, setNewTripDate] = useState('');
  const [newTripDuration, setNewTripDuration] = useState(1);
  const [selectedDay, setSelectedDay] = useState('All');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (!currentUser) {
            signInAnonymously(auth).catch((error) => console.error("Auth Error:", error));
        }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google Login Error:", error);
        alert("Google 登入失敗: " + error.message);
    }
  };

  const handleLogout = async () => {
    if(window.confirm("確定要登出嗎？")) {
        await signOut(auth);
        window.location.reload(); 
    }
  }

  useEffect(() => {
    if (!user) return;
    try {
        const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'trips'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTrips(tripsData);
        }, (error) => {});
        return () => unsubscribe();
    } catch (err) {
        console.error("Setup error:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !currentTrip) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, `trips/${currentTrip.id}/stops`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStops(stopsData);
    }, (error) => console.error("Error fetching stops:", error));
    return () => unsubscribe();
  }, [user, currentTrip]);

  const calculateSchedule = (tripStops) => {
    if (!currentTrip || !tripStops.length || !currentTrip.date) return {};
    const startDateStr = currentTrip.date;
    const startTimeStr = currentTrip.startTime || '08:00'; 
    const tripDuration = currentTrip.durationDays || 1;
    
    const parseDateToLocalMidnight = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const tripStartDay = parseDateToLocalMidnight(startDateStr);
    let currentTimeMs = new Date(tripStartDay);
    const [h, m] = startTimeStr.split(':').map(Number);
    currentTimeMs.setHours(h, m, 0, 0);
    currentTimeMs = currentTimeMs.getTime();

    const daySchedules = {};

    for (let i = 0; i < tripStops.length; i++) {
      const stop = tripStops[i];
      
      if (stop.isFixedTime && stop.fixedDate && stop.fixedTime) {
          const [y, m, d] = stop.fixedDate.split('-').map(Number);
          const [fh, fm] = stop.fixedTime.split(':').map(Number);
          currentTimeMs = new Date(y, m - 1, d, fh, fm).getTime();
      } else if (i > 0) {
        const travelMinutes = stop.travelMinutes || 30;
        currentTimeMs += travelMinutes * 60000;
      }

      let arrivalTime = new Date(currentTimeMs);
      
      const arrivalDateStr = formatDate(arrivalTime);
      const arrivalDateObj = parseDateToLocalMidnight(arrivalDateStr);
      
      const diffTime = arrivalDateObj.getTime() - tripStartDay.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      let currentDayNum = diffDays + 1;

      if (!stop.isFixedTime && currentDayNum <= tripDuration) {
        if (arrivalTime.getHours() >= 22) {
            currentDayNum++;
            const nextDayDate = new Date(tripStartDay);
            nextDayDate.setDate(tripStartDay.getDate() + currentDayNum - 1);
            const [sh, sm] = startTimeStr.split(':').map(Number);
            const nextDayStart = new Date(nextDayDate);
            nextDayStart.setHours(sh, sm, 0, 0);
            currentTimeMs = nextDayStart.getTime();
            arrivalTime = new Date(currentTimeMs);
        }
      }

      if (!stop.isFixedTime && currentDayNum > tripDuration) break;

      const stayMinutes = (stop.stayDuration || 1) * 60;
      let departureTime = new Date(arrivalTime.getTime() + stayMinutes * 60000);
      
      const displayDateStr = formatTabDate(formatDate(arrivalTime));

      const scheduledStop = {
          ...stop,
          calculatedArrival: formatTime(arrivalTime),   
          calculatedDeparture: formatTime(departureTime), 
          fullArrival: arrivalTime, 
          fullDeparture: departureTime, 
          day: currentDayNum,
          displayDate: displayDateStr
      };

      if (!daySchedules[currentDayNum]) {
          daySchedules[currentDayNum] = {
              dateKey: formatDate(arrivalTime),
              stops: [],
              displayDate: displayDateStr
          };
      }
      daySchedules[currentDayNum].stops.push(scheduledStop);
      currentTimeMs = departureTime.getTime();
    }
    
    return daySchedules;
  };

  const scheduledDays = calculateSchedule(stops);

  const handleSaveStop = async (stopData) => {
    const stopsRef = collection(db, 'artifacts', appId, 'users', user.uid, `trips/${currentTrip.id}/stops`);
    
    if (stopData.isFixedTime && stopData.fixedDate && stopData.fixedTime) {
        let prevStop = null;
        if (editingStop) {
             const currentIndex = stops.findIndex(s => s.id === editingStop.id);
             if (currentIndex > 0) prevStop = stops[currentIndex - 1];
        } else {
             if (stops.length > 0) prevStop = stops[stops.length - 1];
        }

        if (prevStop) {
            const targetStart = new Date(`${stopData.fixedDate}T${stopData.fixedTime}:00`);
            const travelMins = stopData.travelMinutes || 30; 
            const requiredPrevDeparture = new Date(targetStart.getTime() - travelMins * 60000);
            
            let prevStopCalculated = null;
            Object.values(scheduledDays).forEach(day => {
                day.stops.forEach(s => {
                    if (s.id === prevStop.id) prevStopCalculated = s;
                });
            });

            if (prevStopCalculated) {
                const prevArrival = prevStopCalculated.fullArrival;
                const newDurationMs = requiredPrevDeparture.getTime() - prevArrival.getTime();
                const newDurationHrs = newDurationMs / (1000 * 60 * 60);
                if (newDurationHrs > 0) {
                     await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, `trips/${currentTrip.id}/stops`, prevStop.id), {
                         stayDuration: Number(newDurationHrs.toFixed(2))
                     }, { merge: true });
                } else {
                    alert('注意：您設定的時間過早，導致上一個行程沒有停留時間。');
                }
            }
        }
    }

    if (editingStop) {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, `trips/${currentTrip.id}/stops`, editingStop.id), stopData, { merge: true });
    } else {
        await setDoc(doc(stopsRef), {
            ...stopData,
            order: stops.length, 
            createdAt: Date.now()
        });
    }
    setIsStopModalOpen(false);
    setEditingStop(null);
  };

  const handleDeleteStop = async (stopId) => {
    if(window.confirm('確定刪除此地點？')) {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, `trips/${currentTrip.id}/stops`, stopId));
        setIsStopModalOpen(false);
    }
  }
  
  const handleExport = () => {
    if (!currentTrip) return;
    let text = `【${currentTrip.title}】\n`;
    text += `日期：${currentTrip.date} (共 ${currentTrip.durationDays} 天)\n\n`;
    Object.keys(scheduledDays).sort((a,b)=>a-b).forEach(dayNum => {
        const day = scheduledDays[dayNum];
        text += `=== 第 ${dayNum} 天 (${day.displayDate}) ===\n`;
        day.stops.forEach((stop, index) => {
            if (index > 0 && stop.travelMinutes) {
                text += `   ⬇️ (${stop.transportMode === 'walking' ? '步行' : stop.transportMode === 'transit' ? '搭車' : '開車'} ${stop.travelMinutes}分)\n`;
            }
            text += `● ${stop.calculatedArrival} - ${stop.calculatedDeparture} | ${stop.name}\n`;
            text += `   (停留 ${Number(stop.stayDuration).toFixed(1)}h)`;
            if(stop.notes) text += ` 筆記: ${stop.notes}`;
            text += `\n   Google Map: https://www.google.com/search?q=${encodeURIComponent(stop.name)}\n\n`;
        });
        text += `\n`;
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTrip.title}_行程表.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateTrip = async () => {
    if (!user) {
        alert("系統尚未完成登入，請稍候再試");
        return;
    }
    if (!newTripTitle || !newTripDate) {
        alert("請填寫「旅程名稱」與「出發日期」！");
        return;
    }
    setIsSubmitting(true); 

    try {
        const newDoc = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'trips'));
        await setDoc(newDoc, {
            title: newTripTitle, 
            date: newTripDate, 
            durationDays: newTripDuration, 
            startTime: '08:00', 
            createdAt: Date.now()
        });
        setNewTripTitle(''); 
        setNewTripDate(''); 
        setIsTripModalOpen(false);
    } catch (error) {
        console.error("Create Trip Error:", error);
        alert(`新增失敗！\n錯誤原因：${error.message}`);
    } finally {
        setIsSubmitting(false); 
    }
  };

  const handleUpdateTransport = async (stopId, data) => {
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, `trips/${currentTrip.id}/stops`, stopId), data, { merge: true });
    setIsTransportModalOpen(false);
    setEditingTransport(null);
  };
  
  const handleDeleteTrip = async (e, tripId) => {
    e.stopPropagation();
    if (window.confirm('確定要刪除整個旅程嗎？此動作無法復原。')) {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'trips', tripId));
        if (currentTrip?.id === tripId) setCurrentTrip(null);
    }
  };

  const openEditTransportModal = (stop) => {
    const stopIndex = stops.findIndex(s => s.id === stop.id);
    const prevStop = stopIndex > 0 ? stops[stopIndex - 1] : null;
    setEditingTransport({ ...stop, prevStopName: prevStop ? prevStop.name : null }); 
    setIsTransportModalOpen(true);
  };

  useEffect(() => { setSelectedDay('All'); }, [currentTrip]);

  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] pb-20 font-sans text-[#4a4238]">
        <header className="bg-[#e8e4d9] text-[#4a4238] p-4 shadow-sm sticky top-0 z-10 pt-safe flex justify-between items-center border-b border-[#dcd7c9]">
          <h1 className="text-xl font-bold flex items-center gap-2 tracking-wide"><Coffee className="w-6 h-6 text-[#8c9a8c]" /> 旅程手帳</h1>
          
          <div>
              {user && !user.isAnonymous ? (
                  <div className="flex items-center gap-2">
                      <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-white shadow-sm" />
                      <button onClick={handleLogout} className="text-xs bg-[#8c9a8c] px-2 py-1 rounded text-white hover:bg-[#7b8c7c]">登出</button>
                  </div>
              ) : (
                  <button onClick={handleGoogleLogin} className="flex items-center gap-1 text-xs bg-white text-[#6b615b] border border-[#dcd7c9] px-3 py-1.5 rounded-full font-bold hover:bg-[#f4f1ea] transition-colors shadow-sm">
                      <LogIn className="w-3 h-3" /> 登入同步
                  </button>
              )}
          </div>
        </header>
        <main className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map(trip => (
            <div key={trip.id} onClick={() => setCurrentTrip(trip)} className="bg-white rounded-xl shadow-[2px_2px_0px_rgba(200,190,180,0.4)] border border-[#e6e2d3] p-5 cursor-pointer hover:border-[#a3b18a] transition-colors relative group">
              <h3 className="font-bold text-lg text-[#4a4238]">{trip.title}</h3>
              <p className="text-[#8d837a] text-sm mt-2 flex items-center gap-1"><Calendar className="w-4 h-4" /> {trip.date} • {trip.durationDays} 天</p>
              
              <button 
                onClick={(e) => handleDeleteTrip(e, trip.id)} 
                className="absolute top-2 right-2 p-3 text-[#d6d0c4] hover:text-[#e76f51] transition-colors z-20"
                title="刪除旅程"
              >
                <Trash2 className="w-5 h-5"/>
              </button>
            </div>
          ))}
          <button onClick={() => setIsTripModalOpen(true)} className="border-2 border-dashed border-[#dcd7c9] bg-[#fdfbf7] rounded-xl p-5 flex flex-col items-center justify-center text-[#9c9288] hover:border-[#a3b18a] hover:text-[#a3b18a] h-32 transition-colors">
              <Plus className="w-8 h-8 mb-2" />新增旅程
          </button>
        </main>
        
        <div className="text-center text-[10px] text-[#b5a89e] mt-8 font-mono opacity-60">
            {APP_VERSION}
        </div>
        
        {isTripModalOpen && (
          <div className="fixed inset-0 bg-[#4a4238]/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#fdfbf7] rounded-2xl w-full max-w-sm p-6 shadow-xl border border-[#e6e2d3]">
              <div className="flex justify-between items-center mb-6 border-b border-[#e6e2d3] pb-3">
                <h3 className="text-lg font-bold text-[#4a4238]">新增旅程</h3>
                <button onClick={()=>setIsTripModalOpen(false)}><X className="w-5 h-5 text-[#9c9288]"/></button>
              </div>
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#6b615b] mb-1">旅程名稱</label>
                    <input type="text" placeholder="例如: 京都散策" className="w-full p-3 bg-white border border-[#dcd7c9] rounded-lg focus:ring-2 focus:ring-[#a3b18a] outline-none transition-all placeholder-[#d6d0c4] text-[#4a4238]" value={newTripTitle} onChange={e=>setNewTripTitle(e.target.value)} />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-[#6b615b] mb-1">出發日期</label>
                    <div className="relative">
                      <input 
                          type="date" 
                          value={newTripDate} 
                          onChange={e=>setNewTripDate(e.target.value)}
                          style={{
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              backgroundColor: '#ffffff',
                              color: '#4a4238',
                              opacity: 1,
                              minHeight: '50px',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #dcd7c9',
                              width: '100%',
                              display: 'block'
                          }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-[#6b615b] mb-1">天數</label>
                    <input type="number" min="1" max="30" className="w-full p-3 bg-white border border-[#dcd7c9] rounded-lg focus:ring-2 focus:ring-[#a3b18a] outline-none text-[#4a4238]" value={newTripDuration} onChange={e=>setNewTripDuration(Number(e.target.value))} />
                  </div>
              </div>

              <div className="flex gap-2 mt-8">
                  <button onClick={()=>setIsTripModalOpen(false)} className="flex-1 p-3 text-[#8d837a] hover:bg-[#f4f1ea] rounded-lg border border-transparent hover:border-[#dcd7c9]">取消</button>
                  <button 
                    onClick={handleCreateTrip} 
                    disabled={isSubmitting}
                    className={`flex-1 p-3 text-[#fdfbf7] rounded-lg font-bold shadow-sm transition-colors ${isSubmitting ? 'bg-[#b5a89e] cursor-wait' : 'bg-[#8c9a8c] hover:bg-[#7b8c7c]'}`}
                  >
                    {isSubmitting ? '紀錄中...' : '建立手帳'}
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col font-sans text-[#4a4238]">
      <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-20 flex items-center gap-3 pt-safe border-b border-[#e6e2d3]">
        <button onClick={() => setCurrentTrip(null)} className="p-2 hover:bg-[#f4f1ea] rounded-full transition-colors"><ArrowRight className="w-6 h-6 rotate-180 text-[#8d837a]" /></button>
        <div className="flex-1 overflow-hidden">
            <h1 className="font-bold text-lg leading-tight truncate text-[#4a4238]">{currentTrip.title}</h1>
            <p className="text-xs text-[#9c9288] mt-0.5">{currentTrip.date}</p>
        </div>
        <button onClick={handleExport} className="p-2 text-[#8c9a8c] hover:bg-[#f4f1ea] rounded-full" title="匯出行程"><Share2 className="w-5 h-5" /></button>
        <button onClick={() => { setEditingStop(null); setIsStopModalOpen(true); }} className="bg-[#8c9a8c] text-white p-2 rounded-full shadow-md hover:bg-[#7b8c7c] transition-transform active:scale-95">
            <Plus className="w-6 h-6" />
        </button>
      </header>
      
      <div className="bg-[#fdfbf7] px-4 pt-3 pb-0 sticky top-[64px] z-10 overflow-x-auto scrollbar-hide border-b border-[#e6e2d3] touch-pan-x">
        <div className="flex space-x-1 min-w-max">
            <button onClick={() => setSelectedDay('All')} className={`py-2 px-4 text-sm rounded-t-lg transition-all border-t border-l border-r ${selectedDay === 'All' ? 'bg-white border-[#e6e2d3] text-[#4a4238] font-bold mb-[-1px] pb-3' : 'bg-[#f4f1ea] border-transparent text-[#9c9288] hover:bg-[#ebe7df]'}`}>總覽</button>
            {Array.from({ length: currentTrip.durationDays || 1 }).map((_, i) => {
                const tabDate = new Date(currentTrip.date + 'T00:00:00'); 
                const [y, m, d] = currentTrip.date.split('-').map(Number);
                const loopDate = new Date(y, m - 1, d + i);
                const dateStr = formatDate(loopDate);

                return (
                    <button key={i+1} onClick={() => setSelectedDay(i+1)} className={`py-2 px-4 text-sm rounded-t-lg transition-all border-t border-l border-r ${selectedDay === i+1 ? 'bg-white border-[#e6e2d3] text-[#4a4238] font-bold mb-[-1px] pb-3' : 'bg-[#f4f1ea] border-transparent text-[#9c9288] hover:bg-[#ebe7df]'}`}>
                        {formatTabDate(dateStr)}
                    </button>
                );
            })}
        </div>
      </div>
      
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {Object.keys(scheduledDays).filter(d => selectedDay === 'All' || Number(d) === selectedDay).sort((a,b)=>a-b).map(dayNum => (
            <div key={dayNum} className="mb-8 animate-in slide-in-from-bottom-2 duration-500">
                <div className="py-2 mb-4 sticky top-0 z-0">
                    <h2 className="text-lg font-bold text-[#6b615b] flex items-center gap-2 bg-[#fdfbf7]/90 backdrop-blur-sm w-fit px-3 py-1 rounded-lg border border-[#e6e2d3]">
                        <Calendar className="w-4 h-4 text-[#8c9a8c]" /> {scheduledDays[dayNum].displayDate} 
                    </h2>
                </div>
                <div className="flex flex-col relative pl-2">
                    {scheduledDays[dayNum].stops.map((stop, idx) => (
                        <div key={stop.id} className="relative z-10 mb-2">
                            {idx > 0 && stops.findIndex(s => s.id === stop.id) > 0 && (
                                <TransportItem stop={stop} onEdit={openEditTransportModal} />
                            )}
                            <LocationItem stop={stop} onEdit={(s) => { setEditingStop(s); setIsStopModalOpen(true); }} />
                        </div>
                    ))}
                </div>
            </div>
        ))}
        {stops.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-[#d6d0c4]">
                <div className="bg-white p-6 rounded-full shadow-[2px_2px_0px_rgba(200,190,180,0.3)] border border-[#e6e2d3] mb-4">
                    <Coffee className="w-12 h-12 text-[#b5a89e]" />
                </div>
                <p>點擊右上角 + 開始寫下你的旅程</p>
            </div>
        )}
        
        <div className="text-center text-[10px] text-[#b5a89e] mt-8 mb-4 font-mono opacity-60">
            {APP_VERSION}
        </div>
      </main>

      {isStopModalOpen && (
        <StopModal 
          isOpen={isStopModalOpen} 
          onClose={() => setIsStopModalOpen(false)}
          onSave={handleSaveStop}
          onDelete={editingStop ? () => handleDeleteStop(editingStop.id) : null}
          initialData={editingStop}
          tripStartDate={currentTrip.date}
          tripDuration={currentTrip.durationDays}
          selectedDay={selectedDay}
        />
      )}

      {isTransportModalOpen && (
        <TransportModal 
          isOpen={isTransportModalOpen}
          onClose={() => setIsTransportModalOpen(false)}
          onSave={(data) => handleUpdateTransport(editingTransport.id, data)}
          initialData={editingTransport}
        />
      )}
    </div>
  );
}

function StopModal({ isOpen, onClose, onSave, onDelete, initialData, tripStartDate, tripDuration, selectedDay }) {
  const [name, setName] = useState(initialData?.name || '');
  const [stayDuration, setStayDuration] = useState(initialData?.stayDuration || 1);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isFixedTime, setIsFixedTime] = useState(initialData?.isFixedTime || false);
  const [fixedDate, setFixedDate] = useState(initialData?.fixedDate || tripStartDate);
  const [fixedTime, setFixedTime] = useState(initialData?.fixedTime || '08:00');

  useEffect(() => {
    if (!initialData && typeof selectedDay === 'number') {
        const [y, m, d] = tripStartDate.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d + selectedDay - 1);
        setFixedDate(formatDate(targetDate));
        
        // 修正邏輯：如果是在 Day 2, Day 3... 新增，預設開啟固定時間，確保它出現在當天
        // 如果是 Day 1 或 All，則預設關閉固定時間 (接續制)
        if (selectedDay > 1) {
            setIsFixedTime(true);
            setFixedTime('09:00'); // 預設 9 點開始
        } else {
            setIsFixedTime(false);
        }
    }
  }, [initialData, selectedDay, tripStartDate]);

  const dayOptions = Array.from({ length: tripDuration || 1 }).map((_, i) => {
      const [y, m, d] = tripStartDate.split('-').map(Number);
      const loopDate = new Date(y, m - 1, d + i);
      const dateStr = formatDate(loopDate);
      return {
          dayNum: i + 1,
          dateStr: dateStr,
          display: formatTabDate(dateStr) 
      };
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#4a4238]/40 flex items-end md:items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
      <div className="bg-[#fdfbf7] w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] border border-[#e6e2d3]">
        <div className="flex justify-between items-center mb-6 border-b border-[#e6e2d3] pb-3">
          <h3 className="text-xl font-bold text-[#4a4238]">{initialData ? '編輯地點' : '新增地點'}</h3>
          <button onClick={onClose} className="p-2 bg-[#f4f1ea] rounded-full hover:bg-[#ebe7df]"><X className="w-5 h-5 text-[#9c9288]" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-[#6b615b] mb-1">地點名稱</label>
            <div className="relative">
                <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-[#b5a89e]" />
                <input type="text" placeholder="例如: 淺草寺" className="w-full pl-10 p-3 bg-white border border-[#dcd7c9] rounded-xl focus:ring-2 focus:ring-[#a3b18a] outline-none text-[#4a4238]" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="border border-[#dcd7c9] rounded-xl p-3 bg-white">
               <div className="flex items-center justify-between mb-2">
                   <label className="text-sm font-bold text-[#6b615b] flex items-center gap-1">
                        <Clock className="w-4 h-4" /> 指定開始時間
                   </label>
                   <input 
                      type="checkbox" 
                      checked={isFixedTime} 
                      onChange={(e) => setIsFixedTime(e.target.checked)}
                      className="w-5 h-5 accent-[#8c9a8c]"
                   />
               </div>
               
               {isFixedTime ? (
                   <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                       <select 
                          className="p-2 border border-[#dcd7c9] rounded-lg text-sm bg-[#fdfbf7] text-[#4a4238]"
                          value={fixedDate}
                          onChange={(e) => setFixedDate(e.target.value)}
                       >
                           {dayOptions.map(opt => (
                               <option key={opt.dayNum} value={opt.dateStr}>{opt.display}</option>
                           ))}
                       </select>
                       <input 
                          type="time" 
                          className="p-2 border border-[#dcd7c9] rounded-lg text-sm bg-[#fdfbf7] text-[#4a4238]"
                          value={fixedTime}
                          onChange={(e) => setFixedTime(e.target.value)}
                       />
                   </div>
               ) : (
                   <p className="text-xs text-[#9c9288]">關閉時，時間將依據上個行程自動計算。</p>
               )}
          </div>

          <div>
            <label className="block text-sm font-bold text-[#6b615b] mb-1">預計停留 (小時)</label>
            <div className="flex items-center gap-4">
                <input 
                    type="number" 
                    min="0" 
                    step="0.5" 
                    value={stayDuration} 
                    onChange={(e) => setStayDuration(Math.max(0, Number(e.target.value)))} 
                    className="flex-1 p-3 bg-white border border-[#dcd7c9] rounded-xl outline-none text-[#4a4238] font-mono text-center focus:ring-2 focus:ring-[#a3b18a]" 
                />
                <span className="w-8 text-[#8c9a8c] font-bold">h</span>
            </div>
          </div>
          
          <div>
              <label className="block text-sm font-bold text-[#6b615b] mb-1">手帳筆記</label>
              <textarea className="w-full p-3 bg-white border border-[#dcd7c9] rounded-xl h-24 text-sm focus:ring-2 focus:ring-[#a3b18a] outline-none text-[#4a4238]" placeholder="寫點什麼..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          {onDelete && <button onClick={onDelete} className="p-3 text-[#e76f51] bg-[#fff5eb] hover:bg-[#ffeadd] rounded-xl transition-colors"><Trash2 className="w-6 h-6" /></button>}
          <button 
            onClick={() => onSave({ 
                name, stayDuration, notes, 
                isFixedTime, fixedDate, fixedTime,
                travelMinutes: initialData?.travelMinutes || 30,
                transportMode: initialData?.transportMode || 'driving'
            })}
            disabled={!name}
            className="flex-1 p-3 bg-[#8c9a8c] text-white rounded-xl font-bold shadow-sm disabled:opacity-50 hover:bg-[#7b8c7c] transition-colors">
            {initialData ? '儲存變更' : '加入手帳'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransportModal({ isOpen, onClose, onSave, initialData }) {
    const [mode, setMode] = useState(initialData?.transportMode || 'driving');
    const [minutes, setMinutes] = useState(initialData?.travelMinutes || 30);
    const prevStopName = initialData?.prevStopName;
    const currentStopName = initialData?.name;
    
    const getGoogleMapsUrl = () => {
        if (!prevStopName || !currentStopName) return null;
        return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(prevStopName)}&destination=${encodeURIComponent(currentStopName)}&travelmode=${mode}`;
    };
    
    if (!isOpen) return null;
    const mapsUrl = getGoogleMapsUrl();

    return (
        <div className="fixed inset-0 bg-[#4a4238]/40 flex items-end md:items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-[#fdfbf7] w-full md:max-w-sm rounded-t-2xl md:rounded-2xl p-6 shadow-2xl border border-[#e6e2d3]">
                <div className="flex justify-between items-center mb-6 border-b border-[#e6e2d3] pb-3">
                    <h3 className="text-xl font-bold text-[#4a4238]">交通方式設定</h3>
                    <button onClick={onClose} className="p-2 bg-[#f4f1ea] rounded-full hover:bg-[#ebe7df]"><X className="w-5 h-5 text-[#9c9288]" /></button>
                </div>
                <div className="mb-4">
                     <div className="grid grid-cols-3 gap-3 mb-4">
                        <button onClick={() => setMode('driving')} className={`p-3 rounded-xl flex flex-col items-center gap-2 border transition-all ${mode === 'driving' ? 'border-[#8c9a8c] bg-[#f0f4f0] text-[#6b7c6b]' : 'border-[#e6e2d3] text-[#b5a89e]'}`}><Car className="w-6 h-6" /><span className="text-xs font-bold">開車</span></button>
                        <button onClick={() => setMode('transit')} className={`p-3 rounded-xl flex flex-col items-center gap-2 border transition-all ${mode === 'transit' ? 'border-[#8c9a8c] bg-[#f0f4f0] text-[#6b7c6b]' : 'border-[#e6e2d3] text-[#b5a89e]'}`}><Train className="w-6 h-6" /><span className="text-xs font-bold">大眾運輸</span></button>
                        <button onClick={() => setMode('walking')} className={`p-3 rounded-xl flex flex-col items-center gap-2 border transition-all ${mode === 'walking' ? 'border-[#8c9a8c] bg-[#f0f4f0] text-[#6b7c6b]' : 'border-[#e6e2d3] text-[#b5a89e]'}`}><Footprints className="w-6 h-6" /><span className="text-xs font-bold">步行</span></button>
                    </div>
                    
                    {mapsUrl && (
                        <a 
                            href={mapsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-[#6b7c6b] hover:bg-[#5a6b5a] text-white p-3 rounded-xl font-bold text-center flex items-center justify-center gap-2 shadow-sm transition-colors no-underline block"
                        >
                            <Navigation className="w-5 h-5" /> 1. 查看 Google 地圖 (路徑規劃)
                        </a>
                    )}
                </div>
          
                <div className="mb-6 p-4 rounded-xl bg-white border border-[#dcd7c9]">
                    <label className="block text-sm font-medium text-[#6b615b] mb-2 text-center">2. 輸入確認後的時間 (分鐘)</label>
                    <div className="flex items-center gap-4">
                        <div className="flex-1 text-center bg-[#fdfbf7] h-14 flex items-center justify-center rounded-xl border border-[#dcd7c9]">
                            <input 
                                type="number" 
                                min="0" 
                                value={minutes} 
                                onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))} 
                                className="w-full text-center text-3xl font-extrabold text-[#4a4238] outline-none bg-transparent font-mono" 
                            />
                            <span className="text-sm text-[#9c9288] ml-1 pr-4">分</span>
                        </div>
                    </div>
                </div>
            
                <button onClick={() => onSave({ transportMode: mode, travelMinutes: minutes })} className="w-full p-3 bg-[#8c9a8c] text-white rounded-xl font-bold shadow-sm hover:bg-[#7b8c7c] transition-colors">確認修改</button>
            </div>
        </div>
    );
}