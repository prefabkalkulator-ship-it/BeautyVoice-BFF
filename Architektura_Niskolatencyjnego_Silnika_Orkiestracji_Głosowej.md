Architektura Niskolatencyjnego Silnika Orkiestracji Głosowej w Czasie RzeczywistymWprowadzenie do Architektury Systemów KonwersacyjnychProjektowanie asystentów głosowych operujących w czasie rzeczywistym wymaga fundamentalnej zmiany paradygmatu względem tradycyjnych, sekwencyjnych systemów przetwarzania języka naturalnego. Oczekiwana responsywność, mierzona w milisekundach, stawia przed inżynierami oprogramowania wyzwania przypominające bardziej systemy telekomunikacyjne niż standardowe aplikacje webowe. Budowa dedykowanego silnika orkiestracji dla asystentki głosowej EVA opiera się na rezygnacji z gotowych platform pośredniczących klasy Vapi.ai czy Retell AI. Choć rozwiązania te oferują szybki czas wdrożenia (time-to-market), wprowadzają one nieusuwalne opóźnienia sieciowe, ograniczają granularną kontrolę nad stanem rozmowy oraz generują wysokie koszty operacyjne w skali masowej.Niniejszy raport techniczny przedstawia wyczerpującą analizę architektoniczną własnego, niskolatencyjnego silnika zbudowanego w środowisku Node.js. System ten został zaprojektowany z myślą o bezpośredniej integracji z modelami generatywnymi, w szczególności z rodziną modeli Gemini (warianty 3.5 Flash-Lite oraz natywne API Multimodal Live), z zachowaniem rygorystycznych wymogów dotyczących opóźnienia (Time To First Byte – TTFB), bezbłędnej detekcji aktywności głosowej (VAD), niezawodnego mechanizmu przerywania (barge-in) oraz asynchronicznej obsługi narzędzi (Function Calling) z wykorzystaniem dźwiękowych wypełniaczy.Architektura Sieciowa i Topologia Przepływu DanychAby zminimalizować opóźnienia sieciowe i uniknąć narzutu związanego ze zmianą protokołów w locie, architektura sieciowa musi opierać się na asynchronicznej, w pełni dwukierunkowej komunikacji na pojedynczych, długo żyjących połączeniach. Przepływ danych w projektowanym systemie został zorganizowany wokół centralnego serwera orkiestrującego Node.js, który pełni rolę bezstanowego węzła przetwarzającego strumienie binarne.W pierwszej fazie, system telekomunikacyjny (np. SIP Trunk dostarczany przez operatorów takich jak Twilio) odbiera przychodzące połączenie telefoniczne i natychmiast inicjuje strumień mediów poprzez protokół WebSocket do serwera aplikacyjnego. Zgodnie ze specyfikacją Twilio Media Streams, dźwięk jest przesyłany w formacie G.711 $\mu$-law przy częstotliwości próbkowania 8 kHz. Dane te są pakowane w ustrukturyzowane komunikaty JSON i kodowane w formacie base64. Taka konstrukcja nakłada na serwer obowiązek ciągłego nasłuchiwania na zdarzenia typu media oraz zarządzania identyfikatorami sesji, takimi jak streamSid, które są niezbędne do późniejszego wysyłania odpowiedzi zwrotnych.Po odebraniu pakietów, serwer Node.js dokonuje błyskawicznej dekompresji z formatu $\mu$-law do liniowego formatu PCM (Pulse-Code Modulation), a następnie przeprowadza zmianę częstotliwości próbkowania (resampling) z 8 kHz na 16 kHz. Jest to krok krytyczny, ponieważ zarówno zaawansowane modele detekcji mowy, jak i wejścia audio dla modeli Gemini, są zoptymalizowane pod kątem pasma 16 kHz. Następnie, przetworzony strumień jest rozwidlany. Jedna ścieżka trafia do lokalnej instancji modelu VAD uruchomionej za pomocą silnika ONNX Runtime, która w sposób ciągły analizuje okna czasowe pod kątem obecności głosu ludzkiego. Druga ścieżka gromadzi pakiety w buforze kołowym.Gdy mechanizm VAD potwierdzi aktywność głosową, a następnie precyzyjnie wykryje jej zakończenie, zbuforowane audio jest przesyłane do modelu sztucznej inteligencji. W architekturze zoptymalizowanej pod kątem modeli Gemini, odbywa się to za pośrednictwem Multimodal Live API z wykorzystaniem drugiego połączenia WebSocket. Model Gemini odbiera ramki poprzez komunikaty realtimeInput. Co niezwykle istotne, serwer orkiestrujący nie czeka na pełną odpowiedź. Odbiera on od modelu asynchroniczne komunikaty serverContent, które mogą zawierać gotowe pakiety audio (w przypadku natywnego TTS Gemini) lub strumień tokenów tekstowych. W każdym przypadku wygenerowany sygnał jest na bieżąco resamplowany, kompresowany z powrotem do 8 kHz $\mu$-law i wysyłany do infrastruktury telekomunikacyjnej z zachowaniem rygorystycznego podziału na 20-milisekundowe ramki (dokładnie 160 bajtów surowego audio na pakiet).Komponent ArchitekturyFormat WejściowyOperacja Przetwarzania w Node.jsFormat WyjściowyIngress (Telefonia)JSON (Base64 G.711 $\mu$-law, 8 kHz)Dekodowanie Base64, konwersja $\mu$-law do PCM Int16Bufor PCM Int16 (8 kHz)Warstwa PrzetwarzaniaBufor PCM Int16 (8 kHz)Resampling algorytmem Sinc do 16 kHzBufor PCM Int16 (16 kHz)Warstwa Detekcji (VAD)Bufor PCM Int16 (16 kHz)Konwersja do wektora Float32 (-1.0 do 1.0)Tensor ONNX [1, 1536]Egress (Telefonia)PCM Int16 (od modelu/TTS)Kompresja PCM do $\mu$-law, kodowanie Base64JSON (Base64 G.711 $\mu$-law, 8 kHz)Zarządzanie Strumieniem: WebSockets kontra WebRTC w Środowiskach BezstanowychKluczową decyzją w projektowaniu architektury czasu rzeczywistego jest wybór protokołu transportowego pomiędzy operatorem telekomunikacyjnym a systemem orkiestrującym. Na rynku dominują dwa paradygmaty: standardowe gniazda WebSockets (wykorzystywane m.in. przez Twilio Media Streams) oraz protokoły oparte na WebRTC (implementowane przez frameworki takie jak LiveKit). Decyzja ta wpływa nie tylko na opóźnienia, ale przede wszystkim na zdolność systemu do skalowania w bezstanowych środowiskach kontenerowych, takich jak Kubernetes.Framework LiveKit stanowi potężne, otwartoźródłowe środowisko zbudowane w oparciu o stos WebRTC, które doskonale sprawdza się w przypadku bezpośrednich połączeń z klientami przeglądarkowymi i mobilnymi. Aplikacje korzystające z LiveKit osiągają opóźnienia dla audio na poziomie zaledwie 50 milisekund. Infrastruktura ta składa się z wydajnego serwera napisanego w języku Go (wykorzystującego bibliotekę Pion WebRTC) oraz zestawu SDK, takich jak @livekit/rtc-node czy livekit-server-sdk, które umożliwiają dołączanie agentów backendowych do tzw. "pokojów" (rooms). WebRTC operuje na protokole UDP, co eliminuje problem blokowania wiersza (head-of-line blocking) charakterystyczny dla protokołu TCP.Mimo tych zalet, wykorzystanie LiveKit do obsługi połączeń przychodzących z tradycyjnej sieci telefonicznej (PSTN) poprzez SIP Trunking rodzi ogromne wyzwania architektoniczne. Analiza empiryczna i testy wydajnościowe wykazują, że przepuszczenie połączenia telefonicznego przez infrastrukturę SIP (np. Telnyx lub Twilio) do instancji LiveKit może wygenerować dodatkowe, gigantyczne opóźnienie rzędu 1 do 2,5 sekundy. Taka degradacja wydajności wynika ze skomplikowanego procesu negocjacji sesji (SDP), ustalania kluczy szyfrujących (DTLS-SRTP) oraz samej translacji pakietów RTP na sieć telekomunikacyjną. Z perspektywy asystenta konwersacyjnego, opóźnienie to całkowicie rujnuje wrażenie naturalnej rozmowy.Co ważniejsze, implementacja infrastruktury WebRTC w bezstanowych środowiskach kontenerowych stanowi koszmar operacyjny. WebRTC do transmisji mediów wymaga dynamicznej alokacji szerokiego zakresu portów UDP. Load balancery w klastrach Kubernetes natywnie preferują ruch w warstwie siódmej (HTTP/TCP). Aby WebRTC działało poprawnie, kontenery muszą pracować w trybie sieci hosta (host network mode) lub korzystać ze skomplikowanych serwerów TURN/STUN służących do przebijania się przez warstwy NAT. Ponadto, protokół ten wymusza implementację sztywnego przypisania sesji (sticky sessions), aby pakiety z jednego strumienia RTP trafiały nieprzerwanie do tego samego poda w klastrze.Z kolei bezpośrednie użycie Twilio Media Streams, opartych na protokole WebSocket, idealnie wpisuje się w architekturę cloud-native. Gniazda WebSocket nawiązują połączenie za pomocą standardowego protokołu HTTP (warstwa 7), po czym ulegają aktualizacji (upgrade) do stałego połączenia TCP. Współczesne ingress controllery w Kubernetes potrafią z łatwością rutować ruch WebSocket do dowolnego dostępnego kontenera Node.js. Ponieważ Twilio przejmuje na siebie ciężar komunikacji z siecią komórkową, serwer orkiestrujący operuje wyłącznie na strumieniu ustrukturyzowanych wiadomości JSON. Każdy komunikat zawiera 20 milisekund audio zakodowanego w formacie Base64. Pomimo teoretycznej niższości TCP względem UDP w transmisji mediów (ryzyko retransmisji pakietów), na krótkich dystansach sieciowych pomiędzy chmurą Twilio a środowiskiem AWS/GCP, opóźnienie to jest pomijalne. Eliminacja warstwy WebRTC i SIP Trunkingu na rzecz bezpośredniego przetwarzania strumieni binarnych Base64 znacząco odciąża system i redukuje opóźnienie sieciowe niemal do zera.Kryterium AnalizyTwilio Media Streams (WebSocket / TCP)LiveKit + SIP Trunk (WebRTC / UDP)Opóźnienie Sieciowe (z PSTN)Znikome (bezpośredni interfejs TCP/JSON)Krytyczne (+1.0s do 2.5s przez SIP Trunk)Topologia KontenerowaNatywna (L7 Load Balancing, standardowy Ingress)Złożona (NAT, STUN/TURN, Host Network, UDP)Zarządzanie StanemTrywialne (jedno gniazdo na całe połączenie)Wymaga "sticky sessions" i nadzoru nad agentamiZłożoność ObliczeniowaNiska (parsowanie JSON, proste dekodowanie bajtów)Bardzo wysoka (deszyfracja SRTP, obsługa grafów mediów)W świetle powyższej analizy, dla środowisk nakierowanych na integrację z tradycyjną telefonią, architekturą pierwszego wyboru pozostaje mechanizm WebSocket z bezpośrednim wpięciem w protokoły operatora telekomunikacyjnego, całkowicie z pominięciem frameworków klasy LiveKit.Detekcja Aktywności Głosowej (VAD) w Node.jsZdolność systemu do precyzyjnego i błyskawicznego określania, kiedy użytkownik zaczyna oraz kończy wypowiedź, jest absolutnym fundamentem budowy silnika orkiestracyjnego. Poleganie na modelach transkrypcji w chmurze (Cloud STT) do określania momentów ciszy wprowadza nieakceptowalne opóźnienia i zbędne koszty transferu. Aby zrealizować założenia niskolatencyjne, mechanizm detekcji aktywności głosowej (VAD) musi zostać zaimplementowany bezpośrednio na krawędzi serwera Node.js i przetwarzać nadchodzący sygnał klatka po klatce.Analiza dostępnych technologii wskazuje na trzy wiodące implementacje VAD. Klasyczny algorytm WebRTC VAD, oparty na analizie statystycznej, charakteryzuje się niezwykłą lekkością, jednak w środowiskach telefonicznych (często zaszumionych) radzi sobie fatalnie. Pomiary wskazują, że przy próbie utrzymania wskaźnika fałszywych alarmów (FPR) na poziomie 5%, model WebRTC osiąga zaledwie 50% wskaźnika trafień (TPR), gubiąc co drugą klatkę ludzkiej mowy. Drugą alternatywą jest komercyjny silnik Cobra VAD od Picovoice, stworzony do zastosowań wbudowanych (edge deployment). Model ten osiąga wybitne wyniki – 98,9% TPR przy 5% FPR oraz 95% TPR przy bardzo rygorystycznym 1% FPR. Jest on jednak rozwiązaniem o zamkniętym kodzie źródłowym, wymagającym cyklicznej weryfikacji kluczy dostępu, co przeczy idei budowy w pełni niezależnego stosu opartego na licencjach open-source.Optymalnym i rekomendowanym rozwiązaniem jest Silero VAD. Jest to nowoczesny system oparty na głębokich sieciach neuronowych, udostępniany na permisywnej licencji MIT. Model ten nie posiada wbudowanej telemetrii, dat ważności ani ograniczeń komercyjnych. Z technicznego punktu widzenia, Silero VAD osiąga świetny balans między precyzją a wydajnością, notując 87,7% TPR przy 5% FPR oraz ponad 80% przy 1% FPR. Model jest niezwykle mały – w formacie JIT waży zaledwie około dwóch megabajtów i potrafi przetworzyć 30-milisekundową ramkę audio w czasie poniżej 1 milisekundy na pojedynczym wątku procesora.Implementacja Silero VAD w ekosystemie Node.js wymaga szczególnej uwagi. Popularne pakiety, takie jak @ricky0123/vad-node, zostały zdeprecjonowane na rzecz środowisk przeglądarkowych, co wynika z trudności w utrzymywaniu zależności kompilowanych. Aby uzyskać najwyższą wydajność, należy skorzystać z biblioteki onnxruntime-node, która ładuje wyeksportowany graf modelu Silero VAD (plik .onnx) i wykonuje operacje macierzowe wykorzystując wysokowydajne warstwy napisane w C++ (z wykorzystaniem Node-API). Dzięki temu wątek główny V8 (JavaScript) nie ulega zablokowaniu.Silero VAD narzuca surowe wymogi dotyczące wejścia. Akceptuje on wyłącznie jednokanałowy dźwięk, poddany resamplowaniu do częstotliwości 16 kHz. Próbki PCM muszą zostać zamienione na znormalizowany wektor wartości zmiennoprzecinkowych Float32Array w zakresie wielkości od -1.0 do 1.0. Model operuje na sztywnych oknach czasowych. Dla częstotliwości 16 kHz i okna 96 milisekund wymaga dostarczenia dokładnie 1536 próbek; nowsze wersje (v5) natywnie wspierają okna 32 milisekundowe, redukując rozmiar wejścia, co dodatkowo poprawia czas reakcji.Aby sieć rekurencyjna wewnątrz modelu zachowywała kontekst ciągłości dźwięku, programista musi zarządzać jej stanem ukrytym (state tensor). Pomiędzy wywołaniami inferencji dla kolejnych klatek audio, należy odczytywać tensor stanu z wyjścia modelu i wstrzykiwać go z powrotem na wejście w kolejnym cyklu ewaluacji. Wymiary tego tensora to zazwyczaj [2, 1, 64]. Konstrukcja ta narzuca konieczność utrzymywania niezależnych obiektów sesji ONNX dla każdego dzwoniącego użytkownika, aby zapobiec wyciekowi kontekstu akustycznego między różnymi połączeniami. Kiedy model VAD zwraca wartość prawdopodobieństwa (od 0 do 1) spadającą poniżej ustalonego progu przez zadaną liczbę kolejnych ramek (tzw. redemption frames), system orkiestrujący interpretuje to jako koniec wypowiedzi (turn-boundary) i wyzwala wysyłkę zbuforowanego dźwięku do modeli LLM.Przerywanie Strumienia (Barge-in) i Mechanizmy Czyszczenia BuforówJednym z najtrudniejszych wyzwań w budowie realistycznych asystentów głosowych jest prawidłowa implementacja mechanizmu barge-in, czyli zdolności systemu do natychmiastowego przerwania własnej wypowiedzi w momencie, gdy rozmówca zaczyna mówić. Brak tego rozwiązania powoduje zjawisko nakładania się dwóch głosów, potęgując u użytkownika frustrację i poczucie interakcji z bezmyślnym automatem.Z technicznego punktu widzenia, system musi nieustannie przetwarzać sygnał audio z mikrofonu dzwoniącego, nawet podczas intensywnego odtwarzania wygenerowanej odpowiedzi. Wymaga to odpowiedniej kalibracji detektora VAD. Z powodu braku sprzętowej redukcji echa na wielu liniach GSM, mikrofon użytkownika może "słyszeć" głos bota dobiegający z głośnika telefonu. Z tego względu algorytm barge-in często implementuje się ustalając wyższy próg czułości prawdopodobieństwa z modelu Silero VAD (np. > 0.8) wymagany przez dłuższą serię ciągłych klatek audio, by jednoznacznie odróżnić intencjonalną mowę człowieka od szczątkowego echa akustycznego.Samo wykrycie intencji przerwania to zaledwie początek procesu. Zatrzymanie wysyłania kolejnych ramek audio z poziomu aplikacji Node.js jest działaniem niewystarczającym. Operator telekomunikacyjny (Twilio) posiada na swoich serwerach sprzętowe bufory odtwarzania. Wysłane, lecz jeszcze nieodtworzone sekundy głosu, wciąż znajdują się w pamięci infrastruktury operatora. Jeśli aplikacja poprzestanie na przerwaniu transmisji wewnątrz serwera, użytkownik usłyszy jeszcze resztki zdania wypowiadanego przez bota, sprawiając, że asystent będzie wydawał się ignorować intencję przerwania.Aby wyeliminować tzw. "osierocone audio" (orphan TTS), silnik orkiestrujący musi natychmiast po detekcji barge-in przesłać do gniazda Twilio asynchroniczny komunikat sterujący clear. Formacja tego komunikatu to prosty obiekt JSON, jednak musi on bezwzględnie zawierać identyfikator streamSid, aby infrastruktura Twilio wiedziała, który bufor pamięci należy opróżnić.Konstrukcja komunikatu:JSON{
  "event": "clear",
  "streamSid": "MZ18ad3ab5a11c26b0a2ee"
}
Wysłanie zdarzenia clear w odpowiednim oknie czasowym jest kluczowe. Nawet milisekundowe opóźnienia mogą spowodować przeniknięcie fragmentu starej odpowiedzi do nowej tury konwersacyjnej.Co więcej, należy zainicjować kompleksowe czyszczenie stanu w procesie serwera Node.js. Mechanizm ten składa się z trzech rygorystycznych kroków:Unieważnienie Obietnic (Promise Cancellation): Wewnątrz aplikacji, pętla przesyłająca fragmenty audio z generatora TTS do WebSocketu Twilio musi zostać brutalnie przerwana. Realizuje się to za pomocą natywnego wzorca AbortController. Wywołanie metody abort() natychmiastowo wyzwala wyjątek we wszystkich podpiętych obietnicach (Promises), zatrzymując wykonanie asynchronicznych funkcji generujących opóźnienia sprzętowe.Anulowanie Generowania (Upstream Abort): Jeśli system orkiestracyjny jest połączony z zewnętrznym dostawcą TTS lub asynchronicznym API LLM (np. Gemini), należy wysłać odpowiedni komunikat anulujący żądanie, aby zminimalizować niepotrzebne koszty inferencji po stronie dostawcy i oszczędzić limit tokenów.Zrzucanie Późnych Pakietów (Late Audio Dropping): System musi posiadać sprzętowe flagi (np. stan agentSpeaking ustawiony na false), które zmuszą proces do bezwzględnego zrzucenia wszelkich pakietów audio nadesłanych z pewnym opóźnieniem przez infrastrukturę LLM/TTS. Zignorowanie tego kroku grozi przesłaniem pojedynczych klatek audio, które dla ludzkiego ucha zabrzmią jak trzaski lub zniekształcone, "poszarpane" zgłoski (pop and click artifacts).Minimalizacja Latencji (TTFB) i Metody Strumieniowania (Chunking)Osiągnięcie opóźnień poniżej 500 milisekund (TTFB - Time To First Byte) jest najważniejszym kryterium ewaluacyjnym systemów konwersacyjnych w czasie rzeczywistym. W klasycznym paradygmacie, opóźnienia kumulowały się na każdym etapie: nagranie mowy, wysłanie do modelu STT, przetworzenie przez LLM (czekając na kropkę) i przesłanie całego zdania do syntezatora TTS. Łączny czas oscylował często między 3 a 6 sekundami, czyniąc interakcję do bólu nienaturalną. Rozwiązanie tego problemu w Node.js opiera się na agresywnym strumieniowaniu i technice potokowego przetwarzania danych (pipeline processing).Zastosowanie Modeli Multimodalnych z Natywnym DźwiękiemSkok technologiczny, jaki oferuje integracja z rodziną modeli Gemini (szczególnie Gemini 3.5 Flash-Lite lub 3.1 Flash Live), pozwala na drastyczne skrócenie tego rurociągu. Modele te charakteryzują się natywnym wsparciem dla interakcji głosowych za pośrednictwem Multimodal Live API, operującego poprzez stanowe połączenie WebSocket. W tym scenariuszu eliminuje się całkowicie zewnętrzną warstwę transkrypcji (STT). Pakiety z dźwiękiem ludzkim są przesyłane bezpośrednio z aplikacji do chmury Google za pomocą zdarzeń oznaczonych jako realtimeInput.Największa przewaga tej architektury ujawnia się w drodze powrotnej. Model LLM nie zwraca surowego tekstu, lecz natychmiast wysyła fragmenty syntezowanego głosu w obiektach serverContent.audio. Orkiestrator Node.js działa tu jedynie jako wysoko przepustowy przekaźnik (pass-through). Jego zadaniem jest jedynie pochwycenie gotowego strumienia, zmiana próbkowania na zgodne z telefonią i natychmiastowa kompresja do $\mu$-law bez oczekiwania na jakąkolwiek semantyczną strukturę.Strategia Strumieniowania Tekstu (Text Chunking) i Równoległej SyntezyNawet jeśli architektura z różnych względów wymusza użycie modelu językowego zwracającego tekst (np. klasyczne zapytania do Gemini Pro połączone z zewnętrznym, hiper-szybkim silnikiem TTS jak Kokoro-82M), konieczne jest wdrożenie skomplikowanej strategii fragmentacji tekstu (tzw. chunking). Oczekiwanie na wygenerowanie pełnej odpowiedzi przez LLM to najgorszy możliwy anty-wzorzec.Strumieniowanie z modelem LLM odbywa się token po tokenie. Silnik Node.js musi buforować przychodzące tokeny i w czasie rzeczywistym skanować powstający ciąg znaków (string) pod kątem logicznych przerw w mowie, czyli interpunkcji zwiastującej koniec sensownej frazy (kropki, przecinki, wykrzykniki, znaki zapytania). Analiza wyrażeniami regularnymi lub lekkimi bibliotekami NLP pozwala na identyfikację tzw. "zdań składowych".W momencie, w którym zbuforowany tekst zamyka się przecinkiem (np. "Oczywiście, sprawdzę to dla ciebie,"), serwer natychmiast odrywa tę frazę i asynchronicznie przesyła ją do generatora TTS. Podczas gdy silnik TTS konwertuje ten pierwszy blok (Chunk 1) na dźwięk, a operator telekomunikacyjny zaczyna go odtwarzać w słuchawce użytkownika, model LLM w tle kontynuuje generowanie tekstu dla drugiej części zdania (Chunk 2). Zjawisko to maskuje opóźnienia. Czas potrzebny na przetworzenie kolejnych bloków tekstu na mowę ukrywa się w czasie odtwarzania poprzednich fragmentów. Jest to tak zwane potokowanie asynchroniczne (asynchronous pipelining).Kluczowe w strumieniowaniu chunków do Twilio jest to, że zewnętrzne silniki TTS bardzo często dołączają do zwracanych strumieni nagłówki charakterystyczne dla kontenerów .wav (RIFF, fmt, data). Nagłówki te zawierają metadane (częstotliwość, bit depth). Jeśli orkiestrator przekonwertuje je bezmyślnie na Base64 i przekaże do Twilio, pierwsze ułamki sekund każdego wypowiedzianego zdania ulegną drastycznemu zniekształceniu (słyszalny, nieprzyjemny pisk i trzask). Silnik orkiestrujący musi używać flag żądających wyjścia bezkontenerowego (np. container=none lub raw) z silnika TTS, ewentualnie programowo w Node.js precyzyjnie obcinać pierwsze 44 bajty strumienia binarnego przed przekazaniem pakietu do dekodera $\mu$-law.Obsługa Wypełniaczy (Tool Messages & Fillers) podczas Wywoływania NarzędziAsystenci głosowi nowej generacji nie tylko rozmawiają, ale przede wszystkim wykonują zadania. Wykorzystanie mechanizmu Function Calling pozwala na integrację logiki biznesowej, np. sprawdzanie statusu zamówienia w bazie SQL czy zakładanie ticketów w systemach wsparcia. Niemniej jednak operacje te narzucają własne opóźnienia sieciowe, które potrafią trwać od setek milisekund do kilku sekund. Z punktu widzenia dzwoniącego użytkownika, nagła, wielosekundowa cisza w słuchawce sugeruje rozłączenie lub zawieszenie się systemu. Aby maskować te opóźnienia, architektura wymaga zaawansowanego technicznego mechanizmu wstrzykiwania "wypełniaczy" (ang. fillers).Proces techniczny zarządzania wypełniaczami opiera się na wysoce współbieżnej naturze pętli zdarzeń (Event Loop) w Node.js, która musi obsługiwać wywołania sieciowe i strumieniowanie binariów bez blokowania wątku głównego.Przechwycenie Żądania Narzędzia:
Multimodal Live API Gemini emituje specjalny komunikat JSON o typie toolCall. Wiadomość ta zawiera identyfikator narzędzia (id), precyzyjnie określoną nazwę zarejestrowanej wcześniej funkcji oraz obiekty argumentów wyekstrahowane z kontekstu rozmowy.Zawieszenie i Asynchroniczne Wywołanie:
Po rozpoznaniu węzła toolCall, system orkiestrujący zawiesza dalsze nasłuchiwanie na wygenerowany dźwięk od modelu. Wewnątrz środowiska asynchronicznego uruchamiane jest zapytanie do odpowiedniego API backendowego (np. zapytanie REST do zewnętrznej bazy wiedzy), które jest owinięte we własny blok Promise.Aktywacja Strumienia Wypełniacza (Bypass TTS):
Równolegle, bez czekania na zwrot danych z bazy, system aplikacyjny podnosi z dysku (lub pamięci wbudowanej) pre-renderowany plik audio z nagranym wcześniej wypełniaczem (np. "Daj mi sekundę, sprawdzam to w naszych systemach..."). Plik ten musi być uprzednio spreparowany: pozbawiony nagłówków WAV (format RAW), zresamplowany do 8 kHz i poddany kompresji $\mu$-law. Specjalna funkcja asynchroniczna przejmuje gniazdo Twilio i zaczyna cyklicznie "pompować" chunki 20-milisekundowe bezpośrednio w sieć. Mechanizm ten kompletnie omija konieczność używania kosztownego zewnętrznego silnika TTS.Zabezpieczenie Strumienia Konkurencji (Abort Signals):
Krytycznym aspektem inżynieryjnym jest zabezpieczenie odtwarzania wypełniacza przed kolizjami. Jeśli użytkownik, słysząc wypełniacz, zdecyduje się wtrącić (barge-in), detektor VAD zarejestruje zdarzenie na wejściowym paśmie audio. Logika VAD niezwłocznie wywoła metodę abort() instancji AbortController przypisanej do pętli pompującej wypełniacz. Spowoduje to jej natychmiastowe wyrzucenie wyjątku (Exception) i wysłanie komunikatu clear do Twilio, pozwalając na płynne przejęcie kontroli przez człowieka.Konkatenacja i Synchronizacja po Wykonaniu Zadania:
Jeśli wywołanie API zakończy się sukcesem przed końcem odtwarzania wypełniacza, system nie może od razu wysłać wygenerowanego wyniku zwrotnego. Zastosowanie blokad (np. oczekiwanie na spełnienie Promise odtwarzania) zabezpiecza przed nałożeniem się powracającego głosu z modelu na wciąż wybrzmiewający wypełniacz. Gdy wypełniacz dobiegnie końca, serwer preparuje wiadomość toolResponse, dołączając odpowiedni identyfikator powiązany z wywołaniem, wstrzykuje wynik działania funkcji w pole response i przesyła go do Gemini. Model, dysponując zaktualizowanym kontekstem, wygeneruje płynną kontynuację rozmowy.Rekomendacja Stosu Technologicznego dla Ekosystemu NPM (Node.js)Projektowanie silnika operującego na strumieniach binarnych i niskich opóźnieniach wymaga radykalnego odrzucenia popularnych, ciężkich abstrakcji używanych do tworzenia standardowych REST API. Wydajność orkiestratora Node.js warunkowana jest powstrzymaniem środowiska JavaScript od obciążających operacji matematycznych, delegując je całkowicie do natywnych bibliotek C/C++ poprzez Node-API (N-API). Optymalizacja zjawiska odśmiecania pamięci (Garbage Collection) wymaga również precyzyjnego ustrukturyzowania obiektów.Poniższa tabela przedstawia rekomendowany stos narzędziowy z repozytorium NPM, pozwalający na zbudowanie architektur pozbawionych nieprzewidywalnych opóźnień:Zadanie ArchitektoniczneRekomendowany Pakiet NPMUzasadnienie i Kontekst ZastosowaniaBrama i Routing WebSocketfastify, @fastify/websocket, surowe wsFastify oferuje nieporównywalnie wyższą przepustowość routingu (nawet o 20% mniejszy narzut na żądanie) w zestawieniu ze starzejącym się frameworkiem Express. Czysty pakiet ws zapewnia bezkompromisową, niskopoziomową kontrolę nad obsługą gniazd.Inferencja VAD / Rozpoznawanieonnxruntime-node, ewentualnie avr-vadNiezbędne do uruchomienia modelu Silero VAD (dystrybuowanego w formacie .onnx). Zastosowanie onnxruntime-node gwarantuje wykorzystanie wielowątkowości procesora i natywnych optymalizacji matematycznych. Gotowe wrappery jak avr-vad ułatwiają obsługę rozmiarów tensorów, omijając pułapki techniczne pakietu @ricky0123/vad-node.Kompresja i Enkodowanie ($\mu$-law)x-law (następca alawmulaw)Biblioteka wykorzystująca mechanizmy języka TypeScript do konwersji surowych wektorów audio na kompresję logarytmiczną wymaganą przez sieci telekomunikacyjne. Pozwala na błyskawiczne kodowanie mulaw.encode() i dekodowanie bez narzutu starych, nieutrzymywanych rozwiązań.Resampling (Zmiana Próbkowania)node-libsamplerateZmiana z 8 kHz na 16 kHz to kosztowna matematycznie operacja interpolacji. Biblioteka ta wykorzystuje natywny C++ i algorytmy Sinc z biblioteki libsamplerate, całkowicie omijając limitacje wątku głównego V8 i zapobiegając opóźnieniom.Interfejs Modelu (Gemini)@google/genaiOficjalny SDK wspierający punkty końcowe wss://generativelanguage.googleapis.com. Dostarcza typowanie i parsowanie złożonych struktur toolCall, setup, czy serverContent, eliminując potrzebę pisania własnych, podatnych na usterki klientów API.Pseudo-kod Logiki Połączenia: Orkiestracja, Zarządzanie Stanem i AnulowanieAby precyzyjnie zobrazować interakcję mechanizmów detekcji, przerywania (barge-in) oraz asynchronicznej obsługi narzędzi (tool calling), poniżej przestawiono dogłębną strukturę architektoniczną w ustandaryzowanym pseudo-kodzie na bazie języka TypeScript.Przedstawiona logika zakłada ścisłą orientację obiektową. Tworzenie oddzielnej instancji klasy CallOrchestrator dla każdego przychodzącego strumienia pozwala na izolację kontekstu (np. wektorów stanu sieci neuronowej RNN, kluczy dostępu, strumieniowych identyfikatorów z Twilio). Taka hermetyzacja zapobiega krytycznym błędom polegającym na mieszaniu się danych akustycznych od setek równoległych dzwoniących. Wzorzec AbortController służy jako główny oręż do unieważniania długotrwałych zadań w odpowiedzi na bodźce zewnętrzne.TypeScriptimport { WebSocket } from 'ws';
import { InferenceSession, Tensor } from 'onnxruntime-node'; 
import { mulaw, utils } from 'x-law'; 

class CallOrchestrator {
  private twilioWs: WebSocket;
  private geminiWs: WebSocket;
  private streamSid: string = '';
  
  // Zmienne determinujące stan aktualnej rozmowy
  private agentSpeaking: boolean = false;
  private isProcessingTool: boolean = false;
  
  // Kontroler anulowania do przerywania operacji odtwarzania (Barge-in)
  private activeAudioController: AbortController | null = null;
  
  // Buforowanie stanu ukrytego (RNN) wymagane dla prawidłowego działania Silero VAD
  private vadState: Tensor | null = null; 

  constructor(twilioConnection: WebSocket) {
    this.twilioWs = twilioConnection;
    // Inicjalizacja połączenia bezpośrednio z punktem WSS Gemini Live API
    this.geminiWs = this.initGeminiConnection(); 
    this.setupTwilioListeners();
    this.setupGeminiListeners();
  }

  // --- 1. Warstwa Ingress: Odbiór Sygnałów z Sieci Telekomunikacyjnej ---
  private setupTwilioListeners() {
    this.twilioWs.on('message', async (message: string) => {
      const data = JSON.parse(message);
      
      // Zapisanie identyfikatora koniecznego do oznaczania pakietów Egress oraz zdarzeń czyszczących
      if (data.event === 'start') {
        this.streamSid = data.start.streamSid; 
      }
      
      // Obsługa ciągłego strumienia pakietów mediowych (chunk 20ms)
      if (data.event === 'media') {
        const payloadBase64 = data.media.payload;
        await this.processIncomingAcousticFrames(payloadBase64);
      }
    });
  }

  // --- 2. Warstwa Przetwarzania i Detekcji (VAD) ---
  private async processIncomingAcousticFrames(payloadBase64: string) {
    // Krok A: Dekodowanie z formatu G.711 mu-law (Base64) na liniowy zapis PCM Int16
    const mulawBuffer = Buffer.from(payloadBase64, 'base64');
    const pcmInt16 = mulaw.decodeBuffer(mulawBuffer);
    
    // Krok B: Resampling z częstotliwości 8kHz (standard telefonii) do 16kHz (wymóg Silero VAD i STT)
    const pcm16kHz = utils.resample(pcmInt16, 8000, 16000, 16); 
    
    // Krok C: Przemiana do wektorów zmiennoprzecinkowych dla macierzy głębokich sieci neuronowych
    const float32Audio = this.normalizeToFloat32(pcm16kHz);

    // Krok D: Przekazanie klatki do modelu ONNX. Proces zajmuje <1ms i aktualizuje `this.vadState`.
    const speechProb = await this.runSileroVAD(float32Audio);

    // Ocena prawdopodobieństwa: jeśli wykryto mowę z dużą pewnością podczas gdy bot operuje
    if (speechProb > 0.8) {
      if (this.agentSpeaking || this.isProcessingTool) {
        // Natychmiastowe zidentyfikowanie intencji przerwania przez człowieka
        this.executeBargeInMechanism();
      }
    } else {
      // Brak mowy/koniec tury: sygnał z mikrofonu dzwoniącego może być przekazany do chmury Gemini
      this.streamToGeminiAPI(payloadBase64);
    }
  }

  // --- 3. Mechanizm Natychmiastowego Przerwania (Barge-in) ---
  private executeBargeInMechanism() {
    this.agentSpeaking = false;
    
    // Zrzucenie osieroconego audio po stronie węzłów sieci telekomunikacyjnej Twilio
    this.twilioWs.send(JSON.stringify({
      event: 'clear',
      streamSid: this.streamSid
    }));

    // Zatrzymanie lokalnej pętli odtwarzającej tekst/wypełniacze na serwerze Node.js
    if (this.activeAudioController) {
      this.activeAudioController.abort(); // Metoda `abort` rzuca wyjątek przerywający asynchroniczne pętle
      this.activeAudioController = null;
    }

    // Poinformowanie sztucznej inteligencji, aby przerwała generowanie (oszczędność tokenów)
    this.geminiWs.send(JSON.stringify({ clientContent: { interrupted: true } }));
  }

  // --- 4. Warstwa LLM: Odbiór Odpowiedzi z Gemini API ---
  private setupGeminiListeners() {
    this.geminiWs.on('message', async (message: string) => {
      const data = JSON.parse(message);

      // System odbiera gotowe próbki audio bezpośrednio z silnika natywnego
      if (data.serverContent?.audio) {
        await this.streamGeneratedChunksToCaller(data.serverContent.audio, false);
      }

      // System odbiera intencję wykonania zadania biznesowego
      if (data.toolCall) {
        this.orchestrateToolCallWithFiller(data.toolCall);
      }
    });
  }

  // --- 5. Zarządzanie Asynchronicznymi Wywołaniami Narzędzi i Wypełniaczami ---
  private async orchestrateToolCallWithFiller(toolCall: any) {
    this.isProcessingTool = true;
    
    // Zainicjowanie kontrolera dla przerywnika audio na wypadek wystąpienia zjawiska Barge-in
    this.activeAudioController = new AbortController();
    
    try {
      // 5A: Załadowanie pre-renderowanego, binarnego komunikatu typu "Sprawdzam dane w systemie..."
      // Wysłanie tego strumienia odbywa się jako nieblokujący proces w tle.
      const rawFillerBuffer = this.loadFillerAudioWithoutWavHeader("wait_a_second_filler");
      const fillerPromise = this.streamGeneratedChunksToCaller(rawFillerBuffer, true);

      // 5B: Synchroniczne oczekiwanie na pobranie informacji biznesowych z bazy SQL
      const actionResult = await this.executeBusinessAction(toolCall.functionCalls[0]);

      // 5C: Złożenie wyników w strukturę odpowiedzi dla Multimodal Live API
      this.geminiWs.send(JSON.stringify({
        toolResponse: {
          functionResponses: [{
            id: toolCall.functionCalls[0].id,
            name: toolCall.functionCalls[0].name,
            response: actionResult
          }]
        }
      }));
      
      // 5D: Blokada strumienia. System musi grzecznie zaczekać na całkowite zakończenie 
      // odtwarzania wypełniacza przed zwolnieniem gniazda dla merytorycznej odpowiedzi od LLM.
      await fillerPromise;

    } catch (err) {
      // Wyłapanie wyjątku z AbortController oznacza, że dzwoniący przerwał w trakcie trwania wypełniacza
    } finally {
      this.isProcessingTool = false;
    }
  }

  // --- 6. Egress: Wysyłanie Podzielonego Audio na Linię Telefoniczną ---
  private async streamGeneratedChunksToCaller(audioBase64: string, isFiller: boolean) {
    this.agentSpeaking = true;
    const signal = this.activeAudioController?.signal;

    // Fragmentacja ciągłego ciągu audio na wymagane przez Twilio struktury 160-bajtowe (20ms)
    const chunks = this.splitIntoFixed20msFrames(audioBase64); 

    for (const chunk of chunks) {
      // Zabezpieczenie pętli: Jeśli w innym wątku wywołano `abort()`, wysyłka zostaje wstrzymana
      if (signal?.aborted) throw new Error('Operacja wysyłki została anulowana (barge-in)');

      const mediaMessage = {
        event: 'media',
        streamSid: this.streamSid,
        media: { payload: chunk.toString('base64') }
      };

      this.twilioWs.send(JSON.stringify(mediaMessage));
      
      // Mechanizm dławienia (throttling): Node.js musi symulować realny upływ czasu by nie przepełnić bufora TCP
      await this.sleep(20);
    }
    
    if (!isFiller) this.agentSpeaking = false;
  }
}
Prezentowana wyżej architektura dowodzi zdolności do precyzyjnego orkiestrowania wysoce nieliniowymi i asynchronicznymi procesami konwersacyjnymi. Poprzez zastosowanie bezstanowego podejścia z minimalizacją pośredników oraz delegacją intensywnych operacji obliczeniowych (VAD, resampling) na natywne implementacje, silnik ten jest w stanie zagwarantować bezkompromisowo niski próg latencji (TTFB) i pełną odporność operacyjną, niezbędne do zasilania docelowego asystenta głosowego EVA. Posiadanie własnej infrastruktury telekomunikacyjnej zdejmuje jednocześnie konieczność uiszczania narzutów prowizyjnych (mark-up fees) na minuty połączeń, nakładanych przez komercyjne usługi klasy SaaS.