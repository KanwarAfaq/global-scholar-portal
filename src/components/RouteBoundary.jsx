import React from 'react';
import { useLocation } from 'react-router-dom';
class Boundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.error('Page rendering failed',error);}
  render(){return this.state.failed?<section role="alert" className="rounded-2xl border border-rose-300 p-6"><h1 className="text-xl font-bold">This page could not be displayed</h1><p>Your saved data has not been removed. Reload to try again.</p><button className="admin-action mt-4" onClick={()=>window.location.reload()}>Reload page</button></section>:this.props.children;}
}
export default function RouteBoundary({children}){const location=useLocation();return <Boundary key={location.pathname}>{children}</Boundary>;}
