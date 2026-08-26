# Plan Poprawek (Etapy od najłatwiejszych do najtrudniejszych)

## Etap 1: Drobne teksty i zabezpieczenia przeglądarki (Bardzo Łatwe)
1. **Zabezpieczenie przed tłumaczem**: Dodanie `<html lang="pl" translate="no">` oraz tagu `<meta name="google" content="notranslate">` w pliku `index.html`.
2. **Poprawki copy**: 
   - Strona główna: Przycisk "Rozpocznij korzystanie" (usunięcie słowa "darmowe").
   - Zakładka "Wiedza dla EVA" ("Ucz mnie"): Zmiana tekstu "opowiedz mi o swoim salonie" na "opowiedz mi o swoim biznesie".
3. **Powiadomienie PWA**:
   - Dodanie lekkiego mechanizmu (np. Toast z przyciskiem) przypominającego o możliwości zainstalowania aplikacji PWA.

## Etap 2: Poprawki UX i Kolorystyki (Łatwe/Średnie)
1. **Widok "Baza Wyuczona" (Mobile)**:
   - Przeprojektowanie kafelków pytań i odpowiedzi (Q&A): przeniesienie treści pytania pod przyciski edycji/usuwania, usunięcie marginesu bocznego dla odpowiedzi, by maksymalnie wykorzystać szerokość ekranu telefonu.
2. **Zakładka "Ucz mnie" (Mobile)**:
   - Odsunięcie przycisków w oknie wprowadzania tekstu o 5px w dół.
3. **Zakładka "Subskrypcja"**:
   - Złagodzenie jaskrawych kolorów (Zawieś/Wznów/Anuluj) do palety kolorystycznej "EasyVoiceAssistant" (czernie, szarości, złoto).

## Etap 3: Logowanie i System PIN (Trudne)
1. **Baza Danych (Backend)**: 
   - Dodanie pola `pinCode String?` w modelu `Tenant`.
   - Nowy endpoint `/api/auth/register` (Nazwa firmy, Telefon, PIN) oraz `/api/auth/login` (Telefon, PIN).
2. **Strona Logowania/Rejestracji (Auth.tsx)**:
   - Rozdzielenie widoku `Auth.tsx` na dwa tryby: "Rejestracja" i "Logowanie" zależnie od intencji użytkownika.
   - Tryb **Rejestracja**: Formularz (Nazwa, Telefon, PIN). Przycisk "Załóż konto".
   - Tryb **Logowanie**: Formularz (Telefon, PIN). Przycisk "Wejdź na konto".
3. **Strona Główna (LandingPage.tsx)**:
   - Zmiana przycisków i linkowania tak, by właściwie kierowały do trybu logowania bądź trybu rejestracji na stronie Auth.

Proponuję zacząć od Etapu 1 i 2, wypchnąć je na serwer, po czym zająć się Etapem 3 (PIN), ponieważ on wymaga zmian w bazie danych.
