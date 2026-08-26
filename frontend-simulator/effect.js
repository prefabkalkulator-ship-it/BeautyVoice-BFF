  useEffect(() => {
    if (loading) return;
    let firstWorkingIndex = -1;
    for (let i = 0; i < timeSlots.length; i++) {
      if (columns.some(col => isWorkingHour(col, timeSlots[i]))) {
        firstWorkingIndex = i;
        break;
      }
    }
    if (firstWorkingIndex > 0 && scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: firstWorkingIndex * 48, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [currentDate, loading, columns.length, staffList]);
