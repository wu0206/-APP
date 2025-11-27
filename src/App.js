import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { 
  MapPin, Clock, Navigation, Plus, 
  Calendar, ArrowRight, Car, Trash2, X,
  Footprints, Train, Edit2, ExternalLink, Share2
} from 'lucide-react';

const appId = 'travel-planner-v1'; 

// Helper Functions
const formatDate = (date) => date.toISOString().split('T')[0];
const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

// --- Sub-Components ---
const TransportItem = ({ stop, prevStop, onEdit }) => {
  const getMapUrl = () => {
    if (!prevStop || !stop) return '#';
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(prevStop.name)}&destination=${encodeURIComponent(stop.name)}&travelmode=${stop.transportMode || 'driving'}`;
  };

  const handleEdit = (e) => {
    e.preventDefault(); 
    e.stopPropagation();
    onEdit(stop);
  };

  return (
    <div className="ml-8 mb-4 relative group">
      <div className="absolute left-[-19px] top-[-10px] bottom-[-10px] w-0.5 bg-gray-200 z-0"></div>
      <div className="flex items-center gap-2">
          <a 
            href={getMapUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-between p-3 rounded-xl border border-teal-400 bg-teal-50/80 text-teal-800 cursor-pointer hover:bg-teal-100 transition-colors shadow-sm no-underline"
          >
            <div className="flex items-center gap-2">
              {stop.transportMode === 'walking' ? <Footprints className="w-4 h-4" /> : 
               stop.transportMode === 'transit' ? <Train className="w-4 h-4" /> :
               <Car className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {stop.transportMode === 'walking' ? '步行' : 
                 stop.transportMode === 'transit' ? '大眾運輸' : '開車'} 
                 ・約 {stop.travelMinutes || 30} 分
              </span>
            </div>
            <Navigation className="w-4 h-4 text-teal-600" />
          </a>

          <button 
            onClick={handleEdit}
            className="p-3 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-teal-600 hover:border-teal-400 shadow-sm transition-all active:scale-95"
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
        <div className={`w-3 h-3 rounded-full ring-4 ring-white shadow-sm ${stop.isFixedTime ? 'bg-orange-500' : 'bg-teal-500'}`}></div>
        <span className="text-[10px] font-bold text-gray-500 mt-1 text-center leading-tight">
            {stop.calculatedArrival}
            <br/>
            <span className="text-gray-300 font-normal">抵達</span>
        </span>
      </div>

      <div className={`flex-1 bg-white p-4 rounded-xl shadow-sm border flex gap-3 group transition-colors ${stop.isFixedTime ? 'border-orange-200' : 'border-gray-100 hover:border-teal-200'}`}>
        <a 
            href={googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 cursor-pointer block no-underline"
        >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-gray-800 text-lg leading-tight flex items-center gap-2">
                  {stop.name}
                  {stop.isFixedTime && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded border border-orange-200 whitespace-nowrap">指定時間</span>}
                  <ExternalLink className="w-3 h-3 text-gray-300 opacity-50 group-hover:opacity-100 transition-opacity" />
              </h3>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                <Clock className="w-3 h-3" />
                <span>停留 {Number(stop.stayDuration).toFixed(1).replace(/\.0$/, '')} 小時</span>
              </div>
              <div className="text-xs text-gray-400">
                 {stop.calculatedDeparture} 離開
              </div>
            </div>

            {stop.notes && (
                <p className="mt-2 text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-100 inline-block">
                    {stop.notes}
                </p>
            )}
        </a>

        <div className="flex flex-col gap-2 border-l pl-3 border-gray-100 justify-center">
             <button 
                onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    onEdit(stop); 
                }}
                className="p-3 hover:bg-teal-50 rounded-lg text-gray-400 hover:text-teal-600 transition-colors"
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
  const [isSubmitting, setIsSubmitting] = useState(false); // 新增：防止重複提交與顯示狀態

  // Modal States
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);

  // Editing States
  const [editingStop, setEditingStop] = useState(null);
  const [editingTransport, setEditingTransport] = useState(null);

  // New Data Placeholders
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripDate, setNewTripDate] = useState('');
  const [newTripDuration, setNewTripDuration] = useState(1);
  const [selectedDay, setSelectedDay] = useState('All');

  // --- Auth & Data Loading ---
  useEffect(() => {
    // 監聽登入狀態
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (!currentUser) {
            // 如果沒登入，嘗試匿名登入
            signInAnonymously(auth).catch((error) => {
                console.error("Auth Error:", error);
                alert("無法連線到 Firebase 驗證，請檢查網路。\n錯誤代碼: " + error.code);
            });
        }
    });
    return () => unsubscribe();
  }, []);

  // Load Trips
  useEffect(() => {
    if (!user) return;
    // 使用 try-catch 確保讀取失敗有反應
    try {
        const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'trips'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTrips(tripsData);
        }, (error) => {
            console.error("Error fetching trips:", error);
            // 如果是權限錯誤，通常是因為 Firestore 規則沒設好
            if (error.code === 'permission-denied') {
                alert("讀取資料失敗：權限不足。\n請檢查 Firebase Console 的 Firestore Rules 是否已設為 Test Mode。");
            }
        });
        return () => unsubscribe();
    } catch (err) {
        console.error("Setup error:", err);
    }
  }, [user]);

  // Load Stops
  useEffect(() => {
    if (!user || !currentTrip) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, `trips/${currentTrip.id}/stops`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStops(stopsData);
    }, (error) => console.error("Error fetching stops:", error));
    return () => unsubscribe();
  }, [user, currentTrip]);

  // --- Logic Functions ---
  const calculateSchedule = (tripStops) => {
    if (!currentTrip || !tripStops.length || !currentTrip.date) return {};
    const startDateStr = currentTrip.date;
    const startTimeStr = currentTrip.startTime || '08:00';
    const tripDuration = currentTrip.durationDays || 1;
    
    let currentTimeMs = new Date(`${startDateStr}T${startTimeStr}:00`).getTime();
    const daySchedules = {};

    const getDayStart = (dateStr) => {
      const day = new Date(dateStr);
      day.setHours(0, 0, 0, 0);
      return day;
    };
    const tripStartDay = getDayStart(startDateStr);

    for (let i = 0; i < tripStops.length; i++) {
      const stop = tripStops[i];
      if (stop.isFixedTime && stop.fixedDate && stop.fixedTime) {
          currentTimeMs = new Date(`${stop.fixedDate}T${stop.fixedTime}:00`).getTime();
      } else if (i > 0) {
        const travelMinutes = stop.travelMinutes || 30;
        currentTimeMs += travelMinutes * 60000;
      }

      let arrivalTime = new Date(currentTimeMs);
      const arrivalDay = getDayStart(formatDate(arrivalTime));
      let currentDayNum = Math.floor((arrivalDay.getTime() - tripStartDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (!stop.isFixedTime && currentDayNum <= tripDuration) {
        if (arrivalTime.getHours() >= 22) {
          currentDayNum++;
          const nextDayDate = new Date(tripStartDay);
          nextDayDate.setDate(tripStartDay.getDate() + currentDayNum - 1);
          arrivalTime = new Date(`${formatDate(nextDayDate)}T${startTimeStr}:00`);
          currentTimeMs = arrivalTime.getTime();
        }
      }

      if (!stop.isFixedTime && currentDayNum > tripDuration) break;

      const stayMinutes = (stop.stayDuration || 1) * 60;
      let departureTime = new Date(arrivalTime.getTime() + stayMinutes * 60000);
      
      const stopDateKey = formatDate(arrivalTime);
      const scheduledStop = {
          ...stop,
          calculatedArrival: formatTime(arrivalTime),
          calculatedDeparture: formatTime(departureTime),
          fullArrival: arrivalTime, 
          fullDeparture: departureTime, 
          day: currentDayNum,
          displayDate: new Date(stopDateKey).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
      };

      if (!daySchedules[currentDayNum]) {
          daySchedules[currentDayNum] = {
              dateKey: stopDateKey,
              stops: [],
              displayDate: scheduledStop.displayDate
          };
      }
      daySchedules[currentDayNum].stops.push(scheduledStop);
      currentTimeMs = departureTime.getTime();
    }
    
    return daySchedules;
  };

  const scheduledDays = calculateSchedule(stops);

  // --- Actions ---
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

  // ★★★ 重要：新增旅程的邏輯修復與錯誤偵測 ★★★
  const handleCreateTrip = async () => {
    // 1. 檢查是否已登入
    if (!user) {
        alert("系統尚未完成登入，請稍候再試 (Firebase Auth Initializing...)");
        return;
    }

    // 2. 檢查欄位
    if (!newTripTitle || !newTripDate) {
        alert("請填寫「旅程名稱」與「出發日期」！");
        return;
    }

    setIsSubmitting(true); // 鎖定按鈕

    try {
        const newDoc = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'trips'));
        await setDoc(newDoc, {
            title: newTripTitle, 
            date: newTripDate, 
            durationDays: newTripDuration, 
            startTime: '08:00', 
            createdAt: Date.now()
        });
        
        // 成功後重置
        setNewTripTitle(''); 
        setNewTripDate(''); 
        setIsTripModalOpen(false);
    } catch (error) {
        console.error("Create Trip Error:", error);
        // 3. 顯示具體錯誤
        alert(`新增失敗！\n錯誤原因：${error.message}\n(請檢查 Firebase Console 的 Rules 設定)`);
    } finally {
        setIsSubmitting(false); // 解鎖按鈕
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

  // --- Render (Home View) ---
  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 pb-20 font-sans">
        <header className="bg-teal-700 text-white p-4 shadow-md sticky top-0 z-10 pt-safe">
          <h1 className="text-xl font-bold flex items-center gap-2"><MapPin className="w-6 h-6" /> 旅程規劃</h1>
        </header>
        <main className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map(trip => (
            <div key={trip.id} onClick={() => setCurrentTrip(trip)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md relative group">
              <h3 className="font-bold text-lg text-gray-800">{trip.title}</h3>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-1"><Calendar className="w-4 h-4" /> {trip.date} • {trip.durationDays} 天</p>
              
              <button 
                onClick={(e) => handleDeleteTrip(e, trip.id)} 
                className="absolute top-2 right-2 p-3 text-gray-300 hover:text-red-500 transition-colors z-20"
                title="刪除旅程"
              >
                <Trash2 className="w-5 h-5"/>
              </button>
            </div>
          ))}
          <button onClick={() => setIsTripModalOpen(true)} className="border-2 border-dashed border-gray-300 bg-white/50 rounded-xl p-5 flex flex-col items-center justify-center text-gray-400 hover:border-teal-500 h-32 transition-colors">
              <Plus className="w-8 h-8 mb-2" />新增旅程
          </button>
        </main>
        
        {/* 新增旅程 Modal */}
        {isTripModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">新增旅程</h3>
                <button onClick={()=>setIsTripModalOpen(false)}><X className="w-5 h-5 text-gray-400"/></button>
              </div>
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">旅程名稱</label>
                    <input type="text" placeholder="例如: 東京五天四夜" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all" value={newTripTitle} onChange={e=>setNewTripTitle(e.target.value)} />
                  </div>
                  
                  {/* iOS 日期修正 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">出發日期</label>
                    <div className="relative">
                      <input 
                          type="date" 
                          value={newTripDate} 
                          onChange={e=>setNewTripDate(e.target.value)}
                          style={{
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              backgroundColor: '#ffffff',
                              color: '#000000',
                              opacity: 1,
                              minHeight: '50px',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              width: '100%',
                              display: 'block'
                          }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">天數</label>
                    <input type="number" min="1" max="30" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" value={newTripDuration} onChange={e=>setNewTripDuration(Number(e.target.value))} />
                  </div>
              </div>

              <div className="flex gap-2 mt-6">
                  <button onClick={()=>setIsTripModalOpen(false)} className="flex-1 p-3 text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                  {/* 按鈕狀態回饋 */}
                  <button 
                    onClick={handleCreateTrip} 
                    disabled={isSubmitting}
                    className={`flex-1 p-3 text-white rounded-lg font-bold shadow-lg transition-colors ${isSubmitting ? 'bg-gray-400 cursor-wait' : 'bg-teal-600 hover:bg-teal-700'}`}
                  >
                    {isSubmitting ? '處理中...' : '建立'}
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Render (Details View) ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-20 flex items-center gap-3 pt-safe">
        <button onClick={() => setCurrentTrip(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowRight className="w-6 h-6 rotate-180 text-gray-600" /></button>
        <div className="flex-1 overflow-hidden">
            <h1 className="font-bold text-lg leading-tight truncate">{currentTrip.title}</h1>
            <p className="text-xs text-gray-500">{currentTrip.date}</p>
        </div>
        <button onClick={handleExport} className="p-2 text-teal-600 hover:bg-teal-50 rounded-full" title="匯出行程"><Share2 className="w-5 h-5" /></button>
        <button onClick={() => { setEditingStop(null); setIsStopModalOpen(true); }} className="bg-teal-600 text-white p-2 rounded-full shadow-lg hover:bg-teal-700 transition-transform active:scale-95">
            <Plus className="w-6 h-6" />
        </button>
      </header>
      
      {/* Day Tabs */}
      <div className="bg-white px-4 pt-0 pb-0 shadow-sm sticky top-[64px] z-10 overflow-x-auto scrollbar-hide">
        <div className="flex space-x-2 min-w-max pb-2">
            <button onClick={() => setSelectedDay('All')} className={`py-2 px-4 text-sm rounded-full transition-colors ${selectedDay === 'All' ? 'bg-teal-100 text-teal-800 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>總覽</button>
            {Array.from({ length: currentTrip.durationDays || 1 }).map((_, i) => (
                <button key={i+1} onClick={() => setSelectedDay(i+1)} className={`py-2 px-4 text-sm rounded-full transition-colors ${selectedDay === i+1 ? 'bg-teal-100 text-teal-800 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>D{i+1}</button>
            ))}
        </div>
      </div>
      
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {Object.keys(scheduledDays).filter(d => selectedDay === 'All' || Number(d) === selectedDay).sort((a,b)=>a-b).map(dayNum => (
            <div key={dayNum} className="mb-8 animate-in slide-in-from-bottom-2 duration-500">
                <div className="py-2 mb-4 sticky top-0 z-0">
                    <h2 className="text-lg font-bold text-teal-800 flex items-center gap-2 bg-slate-50/80 backdrop-blur-sm w-fit px-3 py-1 rounded-lg border border-teal-100">
                        <Calendar className="w-4 h-4" /> 第 {dayNum} 天 <span className="text-gray-400 font-normal text-sm">| {scheduledDays[dayNum].displayDate}</span>
                    </h2>
                </div>
                <div className="flex flex-col relative pl-2">
                    <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gray-200 z-0"></div>
                    {scheduledDays[dayNum].stops.map((stop, idx) => (
                        <div key={stop.id} className="relative z-10 mb-2">
                            {idx > 0 && stops.findIndex(s => s.id === stop.id) > 0 && (
                                <TransportItem stop={stop} prevStop={stops[stops.findIndex(s => s.id === stop.id) - 1]} onEdit={openEditTransportModal} />
                            )}
                            <LocationItem stop={stop} onEdit={(s) => { setEditingStop(s); setIsStopModalOpen(true); }} />
                        </div>
                    ))}
                </div>
            </div>
        ))}
        {stops.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                    <MapPin className="w-12 h-12 text-teal-100" />
                </div>
                <p>點擊右上角 + 開始規劃你的旅程</p>
            </div>
        )}
      </main>

      {/* Edit Stop Modal */}
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

// --- Modals ---
function StopModal({ isOpen, onClose, onSave, onDelete, initialData, tripStartDate, tripDuration, selectedDay }) {
  const [name, setName] = useState(initialData?.name || '');
  const [stayDuration, setStayDuration] = useState(initialData?.stayDuration || 1);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isFixedTime, setIsFixedTime] = useState(initialData?.isFixedTime || false);
  const [fixedDate, setFixedDate] = useState(initialData?.fixedDate || tripStartDate);
  const [fixedTime, setFixedTime] = useState(initialData?.fixedTime || '08:00');

  useEffect(() => {
    if (!initialData && typeof selectedDay === 'number') {
        setIsFixedTime(true);
        const d = new Date(tripStartDate);
        d.setDate(d.getDate() + selectedDay - 1);
        setFixedDate(formatDate(d));
    }
  }, [initialData, selectedDay, tripStartDate]);

  const dayOptions = Array.from({ length: tripDuration || 1 }).map((_, i) => {
      const d = new Date(tripStartDate);
      d.setDate(d.getDate() + i);
      return {
          dayNum: i + 1,
          dateStr: formatDate(d),
          display: `第 ${i + 1} 天 (${d.toLocaleDateString('zh-TW', {month:'short', day:'numeric'})})`
      };
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">{initialData ? '編輯地點' : '新增地點'}</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">地點名稱</label>
            <div className="relative">
                <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="例如: 淺草寺" className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
               <div className="flex items-center justify-between mb-2">
                   <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                        <Clock className="w-4 h-4" /> 指定開始時間
                   </label>
                   <input 
                      type="checkbox" 
                      checked={isFixedTime} 
                      onChange={(e) => setIsFixedTime(e.target.checked)}
                      className="w-5 h-5 accent-teal-600"
                   />
               </div>
               
               {isFixedTime ? (
                   <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                       <select 
                          className="p-2 border rounded-lg text-sm bg-white"
                          value={fixedDate}
                          onChange={(e) => setFixedDate(e.target.value)}
                       >
                           {dayOptions.map(opt => (
                               <option key={opt.dayNum} value={opt.dateStr}>{opt.display}</option>
                           ))}
                       </select>
                       <input 
                          type="time" 
                          className="p-2 border rounded-lg text-sm bg-white"
                          value={fixedTime}
                          onChange={(e) => setFixedTime(e.target.value)}
                       />
                   </div>
               ) : (
                   <p className="text-xs text-gray-400">關閉時，時間將依據上個行程自動計算。</p>
               )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">預計停留 (小時)</label>
            <div className="flex items-center gap-4">
                <input type="range" min="0.5" max="8" step="0.5" value={stayDuration} onChange={(e) => setStayDuration(Number(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600" />
                <span className="w-16 text-center font-bold text-teal-600 text-lg">{stayDuration} h</span>
            </div>
          </div>
          
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">備註</label>
              <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-24 text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="輸入筆記..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          {onDelete && <button onClick={onDelete} className="p-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"><Trash2 className="w-6 h-6" /></button>}
          <button 
            onClick={() => onSave({ 
                name, stayDuration, notes, 
                isFixedTime, fixedDate, fixedTime,
                travelMinutes: initialData?.travelMinutes || 30,
                transportMode: initialData?.transportMode || 'driving'
            })}
            disabled={!name}
            className="flex-1 p-3 bg-teal-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 hover:bg-teal-700 transition-colors">
            {initialData ? '儲存變更' : '加入行程'}
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
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white w-full md:max-w-sm rounded-t-2xl md:rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">交通方式設定</h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="mb-4">
                     <div className="grid grid-cols-3 gap-3 mb-4">
                        <button onClick={() => setMode('driving')} className={`p-3 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${mode === 'driving' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 text-gray-400'}`}><Car className="w-6 h-6" /><span className="text-xs font-bold">開車</span></button>
                        <button onClick={() => setMode('transit')} className={`p-3 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${mode === 'transit' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 text-gray-400'}`}><Train className="w-6 h-6" /><span className="text-xs font-bold">大眾運輸</span></button>
                        <button onClick={() => setMode('walking')} className={`p-3 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${mode === 'walking' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 text-gray-400'}`}><Footprints className="w-6 h-6" /><span className="text-xs font-bold">步行</span></button>
                    </div>
                    
                    {mapsUrl && (
                        <a 
                            href={mapsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold text-center flex items-center justify-center gap-2 shadow-lg transition-colors no-underline block"
                        >
                            <Navigation className="w-5 h-5" /> 1. 查看 Google 地圖
                        </a>
                    )}
                </div>
          
                <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-600 mb-2 text-center">2. 輸入確認後的時間 (分鐘)</label>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMinutes(m => Math.max(5, m - 5))} className="w-12 h-12 rounded-xl bg-white border border-gray-200 text-xl font-bold hover:bg-gray-50 active:scale-95 transition-all">-</button>
                        <div className="flex-1 text-center bg-white h-12 flex items-center justify-center rounded-xl border border-gray-200">
                            <input type="number" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full text-center text-2xl font-extrabold text-teal-600 outline-none" />
                            <span className="text-sm text-gray-400 ml-1">分</span>
                        </div>
                        <button onClick={() => setMinutes(m => m + 5)} className="w-12 h-12 rounded-xl bg-white border border-gray-200 text-xl font-bold hover:bg-gray-50 active:scale-95 transition-all">+</button>
                    </div>
                </div>
            
                <button onClick={() => onSave({ transportMode: mode, travelMinutes: minutes })} className="w-full p-3 bg-teal-600 text-white rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-colors">確認修改</button>
            </div>
        </div>
    );
}