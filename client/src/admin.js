import React from 'react';
import openSocket from 'socket.io-client';
import {DropdownToggle, Dropdown, DropdownItem, DropdownMenu} from 'reactstrap';
const socket = openSocket(require('./config.json').api_ip)

export default class AdminPanel extends React.Component {
  constructor(props) {
    super(props)

    this.addCountry = this.addCountry.bind(this);

    socket.emit('countries');
    this.state = { countryName: "", cityName: "", toggle: false, countries: [], country: "" }
    this.toggleDropdown = this.toggleDropdown.bind(this);
    this.addCity = this.addCity.bind(this);
    this.addCountry = this.addCountry.bind(this);
    this.setCountry = this.setCountry.bind(this);
    socket.on('countries', (data) => { this.setState({ countries: data }); });
  }

  toggleDropdown() { this.setState({toggle: !this.state.toggle}); }
  setCountry(country) { socket.emit('countries'); this.setState({country: country}); }

  addCountry(e) {
    e.preventDefault();
    socket.emit("add_country", { country: this.state.countryName })
    socket.emit("countries", { })
    this.setState({countryName: ""})
  }

  addCity(e) {
    e.preventDefault();
    socket.emit("add_city", { country: this.state.country, city: this.state.cityName })
    this.setState({cityName: ""})
  }

  render() {
    return (
      <div>
        <form onSubmit={this.addCountry}>
          <span>Добавить страну: </span><br/>
          <input value={this.state.countryName} onChange={(e)=>{this.setState({countryName: e.target.value})}}/>
          <input type="submit"/>
        </form><br/>
        <form onSubmit={this.addCity}>
          <span>Добавить город: </span><br/>
          <div className="d-flex flex-row">
            <span>Страна: </span>
            <Dropdown isOpen={this.state.toggle} toggle={this.toggleDropdown}>
            <DropdownToggle caret>
              {this.state.country}
              </DropdownToggle>
            <DropdownMenu>
              <DropdownItem header>Страны</DropdownItem>
              {this.state.countries.map((country, i) => {
                return (<DropdownItem key={i} onClick={()=>{this.setCountry(country);}}>{country}</DropdownItem>);
              })}
            </DropdownMenu>
          </Dropdown>
          </div>
          <span>Город: </span>
          <input onChange={(e)=>{this.setState({cityName:e.target.value})}} value={this.state.cityName}/>
          <input type="submit"/>
        </form>
      </div>
    );
  }

}
