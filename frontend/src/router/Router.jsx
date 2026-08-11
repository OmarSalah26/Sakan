import React, { createContext, useContext, useState, useEffect } from 'react';

const RouterContext = createContext(null);

export function RouterProvider({ children }) {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      setPathname(currentPath);
      const savedScroll = sessionStorage.getItem('scrollPos_' + currentPath);
      if (savedScroll !== null) {
        setTimeout(() => window.scrollTo(0, parseInt(savedScroll, 10)), 50);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    // Save current scroll position before navigating away
    sessionStorage.setItem('scrollPos_' + pathname, window.scrollY.toString());
    window.history.pushState({}, '', to);
    setPathname(to);
    
    // Restore scroll position if previously saved for target route
    const savedScroll = sessionStorage.getItem('scrollPos_' + to);
    if (savedScroll !== null) {
      setTimeout(() => window.scrollTo(0, parseInt(savedScroll, 10)), 50);
    } else {
      window.scrollTo(0, 0);
    }
  };

  return (
    <RouterContext.Provider value={{ pathname, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return context;
}

export function useNavigate() {
  const { navigate } = useRouter();
  return navigate;
}

export function useParams() {
  const { params } = useContext(RouteParamsContext) || { params: {} };
  return params;
}

const RouteParamsContext = createContext({ params: {} });

export function Link({ to, children, className, style, onClick, ...props }) {
  const navigate = useNavigate();
  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      navigate(to);
    }
  };
  return (
    <a href={to} onClick={handleClick} className={className} style={style} {...props}>
      {children}
    </a>
  );
}

export function Routes({ children }) {
  const { pathname } = useRouter();
  let matchedChild = null;
  let matchedParams = {};

  React.Children.forEach(children, (child) => {
    if (matchedChild || !React.isValidElement(child)) return;
    const { path } = child.props;
    const { isMatch, params } = matchPath(path, pathname);
    if (isMatch) {
      matchedChild = child;
      matchedParams = params;
    }
  });

  if (!matchedChild) return null;

  return (
    <RouteParamsContext.Provider value={{ params: matchedParams }}>
      {matchedChild}
    </RouteParamsContext.Provider>
  );
}

export function Route({ element }) {
  return element;
}

function matchPath(routePath, currentPath) {
  if (routePath === '*') return { isMatch: true, params: {} };
  
  const routeParts = routePath.split('/').filter(Boolean);
  const currentParts = currentPath.split('/').filter(Boolean);

  if (routeParts.length !== currentParts.length) {
    return { isMatch: false, params: {} };
  }

  const params = {};
  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(':')) {
      const paramName = routeParts[i].slice(1);
      params[paramName] = decodeURIComponent(currentParts[i]);
    } else if (routeParts[i] !== currentParts[i]) {
      return { isMatch: false, params: {} };
    }
  }

  return { isMatch: true, params };
}
